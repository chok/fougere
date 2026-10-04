import Post from './Post.js';

export default class PostCard extends Post.pick('id', 'title', 'status') {}
