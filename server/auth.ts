import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Express } from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { storage } from './storage';
import { User as SelectUser } from '@shared/schema';
declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}
async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return await bcrypt.hash(password, 10);
}
async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  if (!supplied || typeof supplied !== 'string') {
    throw new Error('Supplied password must be a non-empty string');
  }
  if (!stored || typeof stored !== 'string') {
    throw new Error('Stored password must be a non-empty string');
  }
  return await bcrypt.compare(supplied, stored);
}
export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'supersecret',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    },
  };
  app.set('trust proxy', 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  (async () => {
    try {
      const admin = await storage.getUserByUsername('admin');
      if (!admin) {
        const hashedPassword = await hashPassword('admin');
        await storage.createUser({
          username: 'admin',
          password: hashedPassword,
        });
        console.log('Created default user: admin/admin');
      } else {
        console.log('Admin user already exists');
      }
    } catch (error) {
      console.error('Error creating default user:', error);
    }
  })();
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log('Login attempt:', { username, password });
        if (!username || typeof username !== 'string') {
          return done(null, false, { message: 'Username must be a non-empty string' });
        }
        if (!password || typeof password !== 'string') {
          return done(null, false, { message: 'Password must be a non-empty string' });
        }
        const user = await storage.getUserByUsername(username);
        console.log('User from storage:', user);
        if (!user) {
          return done(null, false, { message: 'Invalid credentials' });
        }
        if (!user.password || typeof user.password !== 'string') {
          console.error('Stored password is invalid:', user.password);
          return done(null, false, { message: 'Stored password format is invalid' });
        }
        const isMatch = await comparePasswords(password, user.password);
        console.log('Password match:', isMatch);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid credentials' });
        }
        return done(null, user);
      } catch (error) {
        console.error('Authentication error:', error);
        return done(error);
      }
    })
  );
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      if (!user) {
        return done(new Error('User not found'));
      }
      done(null, user);
    } catch (error) {
      console.error('Deserialize error:', error);
      done(error);
    }
  });
  app.post(
    '/api/login',
    passport.authenticate('local', { failureMessage: true }),
    (req, res) => {
      res.status(200).json({ message: 'Login successful', user: req.user });
    }
  );
  app.post('/api/logout', (req, res, next) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return next(err);
      }
      res.status(200).json({ message: 'Logout successful' });
    });
  });
  app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    res.json(req.user);
  });
}