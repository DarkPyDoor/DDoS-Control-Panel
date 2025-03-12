import { z } from 'zod';
export interface Server {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface Attack {
  id: number;
  serverIds: string;
  method: string;
  target: string;
  threads: number;
  rpc: number;
  duration: number;
  layer: string;
  status: string;
  useProxy: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface Proxy {
  id: number;
  type: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  status: string;
  responseTime?: number;
  markedForDeletion: boolean;
  createdAt: Date;
  updatedAt: Date;
  maxResponseTime?: number;
}
export interface User {
  id: number;
  username: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}
export const L4_METHODS = [
  'ARD',        
  'TCP',        
  'TS3',        
  'ICMP',       
  'MEM',        
  'VSE',        
  'MCBOT',      
  'CPS',        
  'UDP',        
  'FIVEM',      
  'MCPE',       
  'SYN',        
  'DNS',        
  'CHAR',       
  'CLDAP',      
  'NTP',        
  'CONNECTION', 
  'RDP',        
  'MINECRAFT',  
] as const;
export const L7_METHODS = [
  'POST',       
  'APACHE',     
  'TOR',        
  'NULL',       
  'PPS',        
  'BOT',        
  'GSB',        
  'XMLRPC',     
  'SLOW',       
  'DOWNLOADER', 
  'GET',        
  'RHEX',       
  'CFB',        
  'STRESS',     
  'BYPASS',     
  'AVB',        
  'DYN',        
  'EVEN',       
  'CFBUAM',     
  'BOMB',       
  'KILLER',     
  'DGB',        
  'HEAD',       
  'OVH',        
  'STOMP',      
  'COOKIE',     
] as const;
export const insertServerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  host: z.string().min(1, 'Host is required'),
  port: z.number().min(1, 'Port must be at least 1').max(65535, 'Port must be less than 65536'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
export const insertAttackSchema = z.object({
  serverIds: z.string().min(1, 'Server IDs are required'),
  method: z.enum([...L4_METHODS, ...L7_METHODS], { message: 'Invalid attack method' }),
  target: z.string().url('Target must be a valid URL'),
  threads: z.number().min(1, 'Threads must be at least 1'),
  rpc: z.number().min(1, 'RPC must be at least 1'),
  duration: z.number().min(1, 'Duration must be at least 1'),
  layer: z.enum(['L4', 'L7'], { message: 'Layer must be L4 or L7' }),
  useProxy: z.boolean(),
});
export const insertProxySchema = z.object({
  type: z.string().min(1, 'Type is required'),
  host: z.string().min(1, 'Host is required'),
  port: z.number().min(1, 'Port must be at least 1').max(65535, 'Port must be less than 65536'),
  username: z.string().optional(),
  password: z.string().optional(),
});
export const insertUserSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(2, 'Password must be at least 2 characters'),
});
export type InsertServer = z.infer<typeof insertServerSchema>;
export type InsertAttack = z.infer<typeof insertAttackSchema>;
export type InsertProxy = z.infer<typeof insertProxySchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;