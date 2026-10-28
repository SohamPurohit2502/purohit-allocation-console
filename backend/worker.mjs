import {portfolioAPI} from './portfolio-api.mjs';
export default {fetch(request,env){if(new URL(request.url).pathname==='/api/portfolio')return portfolioAPI(request,env);return new Response('Purohit Portfolio API',{headers:{'Content-Type':'text/plain'}})}};
