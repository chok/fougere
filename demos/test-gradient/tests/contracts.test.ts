/**
 * CRAN 2 — plusieurs fronds, ensemble. Le fichier entier.
 *
 * Aucune entité n'est nommée : la liste vient du scan. Une liste d'imports serait une
 * seconde copie de ce que le projet déclare déjà, et elle périmerait le jour où une entité
 * est ajoutée — en silence, parce qu'un test absent ne peut pas échouer.
 */
import { testApp, checkAll } from '@fougere/testing';

checkAll(await testApp());
