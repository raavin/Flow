// Isolated visual-review fixture. Only loaded by the explicit audit Vite config.
import type {PropsWithChildren} from 'react'
export function AppStoreProvider({children}:PropsWithChildren){return children}
export function useAppStore(){return {session:{user:{id:'audit-owner'}},profile:{first_name:'Alex',active_mode:'individual',account_mode:'both'},businessProfile:null,loading:false,signOut:async()=>{},setActiveMode:async()=>{}}}
