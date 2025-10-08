import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, findUserByUsername } from '../dao/userDao.js';

export async function register({ username, password }) {
  const existed = await findUserByUsername(username);
  if (existed) throw new Error('Username already exists');
  const hash = await bcrypt.hash(password, 10);
  const user_id = await createUser({ username, passwordHash: hash });
  return user_id;
}

export async function login({ username, password, jwtSecret }) {
  const user = await findUserByUsername(username);
  if (!user) throw new Error('Invalid credentials');
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error('Invalid credentials');

  const token = jwt.sign({ user_id: user.user_id, username: user.username }, jwtSecret, {
    expiresIn: '7d'
  });
  return { token, user: { user_id: user.user_id, username: user.username } };
}