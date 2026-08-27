// scripts/vite-version-plugin.ts
import { Plugin } from 'vite';

export function viteVersionPlugin(): Plugin {
  let version = '';
  
  return {
    name: 'vite-version-plugin',
    
    buildStart() {
      version = Date.now().toString(36);
      console.log(`📌 Build version: ${version}`);
    },
    
    transformIndexHtml(html: string) {
      return html.replace(
        /(href|src)=["']([^"']*\.(css|js|woff|woff2|ttf|eot|png|jpg|jpeg|gif|svg|ico))["']/gi,
        (match: string, attr: string, url: string) => {
          if (url.startsWith('http://') || url.startsWith('https://')) return match;
          if (url.includes('?v=')) return match;
          if (url.startsWith('data:')) return match;
          return `${attr}="${url}?v=${version}"`;
        }
      );
    },
    
    generateBundle(options: any, bundle: any) {
      const versionInfo = {
        version: version,
        timestamp: new Date().toISOString(),
        buildTime: Date.now()
      };
      
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(versionInfo, null, 2)
      });
    }
  };
}