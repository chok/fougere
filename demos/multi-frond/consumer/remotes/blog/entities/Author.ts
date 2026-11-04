import { Card } from '@fougere/schema';

const Author = Card.fromDescriptor({
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "x-fougere": {
          "role": {
            "primary": true
          },
          "lifecycle": {
            "create": {
              "generate": "uuidv7"
            },
            "update": "forbidden"
          }
        }
      },
      "name": {
        "type": "string",
        "minLength": 1,
        "maxLength": 100
      },
      "email": {
        "type": "string",
        "minLength": 3
      }
    },
    "x-fougere-version": 1,
    "x-fougere-vendor": "fougere",
    "title": "author",
    "required": [
      "name",
      "email"
    ]
  }).toSchema();
export default Author;
