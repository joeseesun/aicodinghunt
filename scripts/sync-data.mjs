import { cpSync, mkdirSync } from 'node:fs'
mkdirSync('public/data', { recursive: true })
cpSync('data/products.json', 'public/data/products.json')
console.log('synced data/products.json → public/data/products.json')
