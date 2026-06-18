// Preload (CommonJS): reicht die lokale API-Basis sicher an den Renderer durch.
// main.js übergibt sie als --erato-api=<url> in additionalArguments.
const { contextBridge } = require('electron')

const arg = process.argv.find((a) => a.startsWith('--erato-api='))
const apiBase = arg ? arg.slice('--erato-api='.length) : 'http://127.0.0.1:3001'

contextBridge.exposeInMainWorld('__ERATO__', { apiBase, local: true })
