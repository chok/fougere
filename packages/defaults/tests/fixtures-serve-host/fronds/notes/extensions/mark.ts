/** An extension a frond carries: it mounts on whichever process serves `notes`. */
export default {
  name: 'mark',
  up(app: { container: { registerValue(key: string, value: unknown): void } }) {
    app.container.registerValue('Marked', 'notes');
  },
};
