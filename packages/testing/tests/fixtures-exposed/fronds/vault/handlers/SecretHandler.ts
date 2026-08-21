import { Crud } from '@fougere/core';
import Secret from '../entities/Secret.js';

export default class SecretHandler extends Crud(Secret) {}
