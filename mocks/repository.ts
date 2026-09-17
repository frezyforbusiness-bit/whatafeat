import {Store,expireProposals} from '@/domain/model';
import {fixture} from './fixtures';
export interface DemoRepository{load():Store;save(store:Store):void;reset():Store}
const key='whatafeat-demo-v1';
export const localRepository:DemoRepository={load(){const raw=localStorage.getItem(key);if(!raw)return fixture();const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.artists)||!Array.isArray(data.collaborations))throw new Error('Saved demo data is incompatible. Reset the demo to continue.');expireProposals(data);return data},save(s){localStorage.setItem(key,JSON.stringify(s,(_,v)=>typeof v==='string'&&v.startsWith('blob:')?undefined:v))},reset(){const s=fixture();this.save(s);return s}};
