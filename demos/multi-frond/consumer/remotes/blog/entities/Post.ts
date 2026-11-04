import { Card } from '@fougere/schema';

const Post = Card.fromDescriptor({
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
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200
      },
      "body": {
        "type": "string"
      },
      "views": {
        "type": "integer",
        "minimum": 0
      },
      "createdAt": {
        "type": "string",
        "format": "date-time",
        "x-fougere": {
          "lifecycle": {
            "create": "now",
            "update": "forbidden"
          }
        }
      }
    },
    "x-fougere-version": 1,
    "x-fougere-vendor": "fougere",
    "title": "post",
    "required": [
      "title",
      "body",
      "views"
    ]
  }).toSchema();
export default Post;
