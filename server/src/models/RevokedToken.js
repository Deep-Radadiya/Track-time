// Refresh tokens that were already used or logged out. They can never be used again.
// MongoDB deletes each row by itself once "expires_at" has passed.
import mongoose from 'mongoose';

const revokedTokenSchema = new mongoose.Schema({
  token_hash: { type: String, required: true, unique: true },
  expires_at: { type: Date, required: true, expires: 0 },
});

export const RevokedToken = mongoose.model('RevokedToken', revokedTokenSchema);
