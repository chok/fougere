import { Crud } from '@fougere/core';
import Post from '../entities/Post.js';

export default class PostHandler extends Crud(Post) {}
