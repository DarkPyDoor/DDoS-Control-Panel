import bcrypt from 'bcrypt';
import * as schema from '../shared/schema';
import { SessionStore } from 'express-session';
const inMemoryData = {
  servers: [] as schema.Server[],
  attacks: [] as schema.Attack[],
  proxies: [] as schema.Proxy[],
  users: [] as schema.User[],
  counters: {
    servers: 0,
    attacks: 0,
    proxies: 0,
    users: 0,
  },
};
async function getServers() {
  return inMemoryData.servers;
}
async function getServer(id: number) {
  return inMemoryData.servers.find(server => server.id === id) || null;
}
async function createServer(server: schema.InsertServer) {
  const newServer: schema.Server = {
    ...server,
    id: ++inMemoryData.counters.servers,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  inMemoryData.servers.push(newServer);
  return newServer;
}
async function updateServerStatus(id: number, status: string) {
  const server = inMemoryData.servers.find(server => server.id === id);
  if (server) {
    server.status = status;
    server.updatedAt = new Date();
    return server;
  }
  return null;
}
async function deleteServer(id: number) {
  const index = inMemoryData.servers.findIndex(server => server.id === id);
  if (index !== -1) {
    inMemoryData.servers.splice(index, 1);
    return true;
  }
  return false;
}
async function getAttacks() {
  return inMemoryData.attacks;
}
async function getAttack(id: number) {
  return inMemoryData.attacks.find(attack => attack.id === id) || null;
}
async function createAttack(attack: schema.InsertAttack) {
  const newAttack: schema.Attack = {
    ...attack,
    id: ++inMemoryData.counters.attacks,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  inMemoryData.attacks.push(newAttack);
  return newAttack;
}
async function updateAttackStatus(id: number, status: string) {
  const attack = inMemoryData.attacks.find(attack => attack.id === id);
  if (attack) {
    attack.status = status;
    attack.updatedAt = new Date();
    return attack;
  }
  return null;
}
async function getProxies() {
  return inMemoryData.proxies;
}
async function getProxy(id: number) {
  return inMemoryData.attacks.find(proxy => proxy.id === id) || null;
}
async function createProxy(proxy: schema.InsertProxy) {
  const newProxy: schema.Proxy = {
    ...proxy,
    id: ++inMemoryData.counters.proxies,
    status: 'pending',
    markedForDeletion: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  inMemoryData.proxies.push(newProxy);
  return newProxy;
}
async function updateProxyStatus(id: number, status: string) {
  const proxy = inMemoryData.proxies.find(proxy => proxy.id === id);
  if (proxy) {
    proxy.status = status;
    proxy.updatedAt = new Date();
    return proxy;
  }
  return null;
}
async function updateProxyResponseTime(id: number, responseTime: number) {
  const proxy = inMemoryData.proxies.find(proxy => proxy.id === id);
  if (proxy) {
    proxy.responseTime = responseTime;
    proxy.updatedAt = new Date();
    return proxy;
  }
  return null;
}
async function markProxyForDeletion(id: number) {
  const proxy = inMemoryData.proxies.find(proxy => proxy.id === id);
  if (proxy) {
    proxy.markedForDeletion = true;
    proxy.updatedAt = new Date();
    return proxy;
  }
  return null;
}
async function getProxiesMarkedForDeletion() {
  return inMemoryData.proxies.filter(proxy => proxy.markedForDeletion);
}
async function deleteProxy(id: number) {
  const index = inMemoryData.proxies.findIndex(proxy => proxy.id === id);
  if (index !== -1) {
    inMemoryData.proxies.splice(index, 1);
    return true;
  }
  return false;
}
async function getUsers() {
  return inMemoryData.users;
}
async function getUserByUsername(username: string) {
  return inMemoryData.users.find(user => user.username === username) || null;
}
async function getUserById(id: number) {
  return inMemoryData.users.find(user => user.id === id) || null;
}
async function createUser(user: { username: string; password: string }) {
  const hashedPassword = await bcrypt.hash(user.password, 10);
  const newUser: schema.User = {
    id: ++inMemoryData.counters.users,
    username: user.username,
    password: hashedPassword,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  inMemoryData.users.push(newUser);
  return newUser;
}
async function updateUser(id: number, userData: { username?: string; password?: string }) {
  const user = inMemoryData.users.find(user => user.id === id);
  if (user) {
    if (userData.username) {
      user.username = userData.username;
    }
    if (userData.password) {
      user.password = await bcrypt.hash(userData.password, 10);
    }
    user.updatedAt = new Date();
    return user;
  }
  return null;
}
async function init() {
  if (inMemoryData.users.length === 0) {
    await createUser({
      username: 'admin',
      password: 'admin',
    });
    console.log('Created default user: admin/admin');
  }
}
init().catch(console.error);
const sessionStore = null as SessionStore | null;
export const storage = {
  getServers,
  getServer,
  createServer,
  updateServerStatus,
  deleteServer,
  getAttacks,
  getAttack,
  createAttack,
  updateAttackStatus,
  getProxies,
  getProxy,
  createProxy,
  updateProxyStatus,
  updateProxyResponseTime,
  markProxyForDeletion,
  getProxiesMarkedForDeletion,
  deleteProxy,
  getUsers,
  getUserByUsername,
  getUserById, 
  createUser,
  updateUser,
  sessionStore,
};