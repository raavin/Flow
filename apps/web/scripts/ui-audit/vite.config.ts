import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
const web=path.resolve(__dirname,'../..')
export default defineConfig({root:web,plugins:[{name:'isolated-ui-audit',enforce:'pre',resolveId(source){if((source==='@/hooks/useAppStore'||source.endsWith('/src/hooks/useAppStore')))return path.resolve(__dirname,'store.tsx');if(source==='@/lib/supabase'||source==='./supabase'||source.endsWith('/src/lib/supabase'))return path.resolve(__dirname,'database.ts')}},react()],resolve:{alias:{'@':path.join(web,'src'),'@superapp/ui':path.resolve(web,'../../packages/ui/src'),'@superapp/types':path.resolve(web,'../../packages/types/src')}},server:{host:'0.0.0.0',port:4173}})
