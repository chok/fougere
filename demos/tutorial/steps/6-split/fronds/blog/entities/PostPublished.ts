import Post from './Post.js';

export default class PostPublished extends Post.pick('id', 'title') {}
