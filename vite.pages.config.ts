import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:'pages',base:'./',publicDir:'../public',plugins:[react()],resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},css:{postcss:{plugins:[tailwindcss()]}},build:{outDir:'../dist-pages',emptyOutDir:false,target:'es2020'}});
