//! telemetry — un Frond Fougère écrit en Rust.
//!
//! Il ne connaît ni TypeScript, ni Kysely, ni Pothos, ni `entity({...})`.
//! Il honore exactement deux choses :
//!
//!   1. le contrat d'appel   — POST /_fougere/call, JSON-RPC 2.0, `method = "entity.op"`,
//!                             `params` = l'InvocationContext ({ params, query, body, state })
//!   2. la carte d'identité  — `rpc.discover` rend ce qu'il héberge, schéma compris
//!
//! Tout le reste lui appartient : le stockage, le langage, le juge.
//! Côté TS personne ne peut le distinguer d'un frond local.

use axum::{extract::State, routing::post, Json, Router};
use serde::Serialize;
use serde_json::{json, Map, Value};
use std::sync::{Arc, Mutex};

// ─── Le domaine — il n'existe qu'ici ────────────────────────────────

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Sensor {
    id: String,
    label: String,
    celsius: f64,
    recorded_at: String,
    /// Calculé par le frond. L'axe boundary le ferme en entrée : jamais accepté d'un client.
    checksum: String,
}

impl Sensor {
    fn record(label: String, celsius: f64) -> Self {
        Sensor {
            id: uuid::Uuid::new_v4().to_string(),
            checksum: checksum(&label, celsius),
            recorded_at: chrono::Utc::now().to_rfc3339(),
            label,
            celsius,
        }
    }
}

/// FNV-1a — le frond réalise, personne d'autre ne peut produire cette valeur.
fn checksum(label: &str, celsius: f64) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    let bytes = label.as_bytes().iter().copied().chain(celsius.to_le_bytes());
    for byte in bytes {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{hash:016x}")
}

// ─── La carte d'identité — les 4 axes en JSON ───────────────────────
// `shape` EST du JSON Schema, au niveau supérieur. Les trois autres axes
// (role, lifecycle, boundary) vivent sous `x-fougere`, le slot d'extension
// standard. Un `reconstruct()` côté TS rebâtit un schéma vivant depuis ça.

fn sensor_card() -> Value {
    json!({
        "title": "sensor",
        "type": "object",
        "properties": {
            "id": {
                "type": "string",
                "format": "uuid",
                "description": "Identité — le frond la génère, jamais le client.",
                "x-fougere": {
                    "role": { "primary": true },
                    "lifecycle": { "create": { "generate": "uuid" } }
                }
            },
            "label": {
                "type": "string",
                "minLength": 2,
                "maxLength": 40,
                "description": "Nom lisible de la sonde."
            },
            "celsius": {
                "type": "number",
                "minimum": -80,
                "maximum": 80,
                "description": "Relevé, en degrés Celsius."
            },
            "recordedAt": {
                "type": "string",
                "format": "date-time",
                "description": "Horodatage — estampillé à la création, immuable ensuite.",
                "x-fougere": {
                    "lifecycle": { "create": "now", "update": "forbidden" }
                }
            },
            "checksum": {
                "type": "string",
                "description": "Empreinte calculée par le frond — lecture seule.",
                "x-fougere": { "boundary": { "in": "closed" } }
            }
        },
        "required": ["label", "celsius"],
        "x-fougere-version": 1,
        "x-fougere-vendor": "fougere"
    })
}

fn identity_card(state: &AppState) -> Value {
    json!({
        "fronds": [{
            "name": "telemetry",
            "entities": [{
                "name": "sensor",
                "ops": state.ops.clone(),
                "schema": sensor_card()
            }]
        }]
    })
}

// ─── Le vocabulaire d'erreur — celui que le TS sait revivre ─────────
// FougereError voyage entier dans `error.data` (jsonrpc.ts:28) ; `error.code`
// reste l'entier réservé par la spec, le code sémantique vit dans la donnée.

#[derive(Serialize)]
struct Failure {
    code: &'static str,
    message: String,
    entity: &'static str,
    operation: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<Value>,
}

impl Failure {
    fn not_found(message: String, op: &str) -> Self {
        Failure { code: "NOT_FOUND", message, entity: "sensor", operation: op.into(), details: None }
    }
}

/// Un refus de validation : le chemin fautif et ce qui cloche.
#[derive(Serialize)]
struct Rejected {
    path: String,
    message: &'static str,
}

// ─── Le juge — la validation juge, le domaine réalise ───────────────
// Volontairement minimal : il applique les règles que la carte annonce, rien
// de plus. Le point de la démo n'est pas la parité des messages, c'est que les
// deux côtés jugent la même chose à partir d'UNE déclaration.

/// Ce qu'un client ne peut pas fournir — les trois exclusions de l'axe io :
/// `role.primary`, `lifecycle.create === 'now'`, `boundary.in === 'closed'`.
fn is_closed(key: &str) -> bool {
    matches!(key, "id" | "recordedAt" | "checksum")
}

fn read_label(object: &Map<String, Value>) -> Result<String, Rejected> {
    let fail = |message| Rejected { path: "label".into(), message };
    match object.get("label") {
        None => Err(fail("Required")),
        Some(Value::String(value)) => match value.chars().count() {
            count if count < 2 => Err(fail("Too short (min 2)")),
            count if count > 40 => Err(fail("Too long (max 40)")),
            _ => Ok(value.clone()),
        },
        Some(_) => Err(fail("Expected a string")),
    }
}

fn read_celsius(object: &Map<String, Value>) -> Result<f64, Rejected> {
    let fail = |message| Rejected { path: "celsius".into(), message };
    match object.get("celsius").map(Value::as_f64) {
        None => Err(fail("Required")),
        Some(None) => Err(fail("Expected a number")),
        Some(Some(value)) if value < -80.0 => Err(fail("Below minimum (-80)")),
        Some(Some(value)) if value > 80.0 => Err(fail("Above maximum (80)")),
        Some(Some(value)) => Ok(value),
    }
}

fn judge(body: &Value) -> Result<(String, f64), Vec<Rejected>> {
    let Some(object) = body.as_object() else {
        return Err(vec![Rejected { path: ".".into(), message: "Expected an object" }]);
    };

    let mut rejected: Vec<Rejected> = object
        .keys()
        .filter(|key| !matches!(key.as_str(), "label" | "celsius"))
        .map(|key| Rejected {
            path: key.clone(),
            message: if is_closed(key) { "Read-only" } else { "Unknown field" },
        })
        .collect();

    match (read_label(object), read_celsius(object)) {
        (Ok(label), Ok(celsius)) if rejected.is_empty() => Ok((label, celsius)),
        (label, celsius) => {
            rejected.extend(label.err());
            rejected.extend(celsius.err());
            Err(rejected)
        }
    }
}

// ─── Les opérations — la façade du frond ────────────────────────────

struct AppState {
    sensors: Mutex<Vec<Sensor>>,
    /// Les termes, pas seulement les noms : ce que l'op fait, et si elle lit ou
    /// écrit. Un appelant qui rencontre ce frond sur le fil n'a rien d'autre.
    ops: Value,
}

fn dispatch(state: &AppState, method: &str, params: &Value) -> Result<Value, Failure> {
    let (entity, op) = method.split_once('.').unwrap_or(("", method));

    match (entity, op) {
        ("rpc", "discover") => Ok(identity_card(state)),

        ("sensor", "list") => {
            let sensors = state.sensors.lock().unwrap();
            Ok(json!(*sensors))
        }

        ("sensor", "findById") => {
            let id = params.get("params").and_then(|p| p.get("id")).and_then(Value::as_str).unwrap_or("");
            let sensors = state.sensors.lock().unwrap();
            sensors
                .iter()
                .find(|sensor| sensor.id == id)
                .map(|sensor| json!(sensor))
                .ok_or_else(|| Failure::not_found(format!("No sensor '{id}'"), op))
        }

        ("sensor", "record") => {
            let body = params.get("body").cloned().unwrap_or(Value::Null);
            match judge(&body) {
                Ok((label, celsius)) => {
                    let sensor = Sensor::record(label, celsius);
                    state.sensors.lock().unwrap().push(sensor.clone());
                    Ok(json!(sensor))
                }
                Err(rejected) => Err(Failure {
                    code: "VALIDATION_FAILED",
                    message: "Validation failed".into(),
                    entity: "sensor",
                    operation: op.into(),
                    details: Some(json!(rejected)),
                }),
            }
        }

        _ => Err(Failure::not_found(format!("Unknown operation '{method}' here"), op)),
    }
}

// ─── Le fil — JSON-RPC 2.0, quelques lignes, aucune lib ─────────────

async fn call(State(state): State<Arc<AppState>>, Json(request): Json<Value>) -> Json<Value> {
    let id = request.get("id").cloned().unwrap_or(Value::Null);
    let method = request.get("method").and_then(Value::as_str).unwrap_or("");
    let params = request.get("params").cloned().unwrap_or(json!({}));

    match dispatch(&state, method, &params) {
        Ok(result) => Json(json!({ "jsonrpc": "2.0", "id": id, "result": result })),
        Err(failure) => Json(json!({
            "jsonrpc": "2.0",
            "id": id,
            // -32000 = APP_ERROR : une défaillance applicative, pas un défaut de trame.
            "error": { "code": -32000, "message": failure.message.clone(), "data": failure }
        })),
    }
}

#[tokio::main]
async fn main() {
    let state = Arc::new(AppState {
        sensors: Mutex::new(vec![
            Sensor::record("cuve-nord".into(), 4.2),
            Sensor::record("cuve-sud".into(), 5.1),
        ]),
        ops: json!([
            { "name": "list",     "kind": "query",   "description": "Toutes les mesures connues, la plus récente d'abord." },
            { "name": "findById", "kind": "query",   "description": "Une mesure, désignée par son identifiant." },
            { "name": "record",   "kind": "command", "description": "Enregistre une mesure. Le frond estampille l'instant et le checksum." }
        ]),
    });

    let app = Router::new().route("/_fougere/call", post(call)).with_state(state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:4200").await.unwrap();

    println!("telemetry (rust) — frond prêt sur http://localhost:4200");
    println!("  1 frond · 1 entité · 3 opérations · rpc.discover");

    axum::serve(listener, app).await.unwrap();
}
