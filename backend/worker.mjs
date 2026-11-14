import {driveAuth} from './drive-auth.mjs';
import {portfolioAPI} from './portfolio-api.mjs';
export default {fetch(request,env){if(['/oauth/start','/oauth/callback'].includes(new URL(request.url).pathname))return driveAuth(request,env);if(new URL(request.url).pathname==='/api/portfolio')return portfolioAPI(request,env);return new Response('Purohit Portfolio API',{headers:{'Content-Type':'text/plain'}})}};
