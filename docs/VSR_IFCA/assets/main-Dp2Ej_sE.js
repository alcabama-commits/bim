const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./auth-viewpoints.test-DXbwuKEz.js","./viewpoints-manager-yVT13weQ.js"])))=>i.map(i=>d[i]);
import{S as Kp,a as Bo,U as pd,V as xr,b as No,c as re,M as un,W as Er,d as da,i as Qp,O as ua,e as fd,G as md,C as Xo,f as ml,F as ef,L as Ri,B as Bt,g as Bi,h as ha,j as Sr,k as Ar,l as nt,n as Cr,m as tf,I as pa,T as zt,R as co,o as bi,p as hn,q as Pt,r as li,s as nf,t as fa,u as gi,v as of,H as rf,w as sf,x as af,D as Cs,y as lf,z as Gi,A as yi,E as cf,J as bl,K as ss,N as df,P as uf}from"./viewpoints-manager-yVT13weQ.js";(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))n(o);new MutationObserver(o=>{for(const r of o)if(r.type==="childList")for(const s of r.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&n(s)}).observe(document,{childList:!0,subtree:!0});function i(o){const r={};return o.integrity&&(r.integrity=o.integrity),o.referrerPolicy&&(r.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?r.credentials="include":o.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(o){if(o.ep)return;o.ep=!0;const r=i(o);fetch(o.href,r)}})();const hf="modulepreload",pf=function(t,e){return new URL(t,e).href},gl={},ff=function(e,i,n){let o=Promise.resolve();if(i&&i.length>0){const s=document.getElementsByTagName("link"),a=document.querySelector("meta[property=csp-nonce]"),l=a?.nonce||a?.getAttribute("nonce");o=Promise.allSettled(i.map(c=>{if(c=pf(c,n),c in gl)return;gl[c]=!0;const d=c.endsWith(".css"),u=d?'[rel="stylesheet"]':"";if(!!n)for(let m=s.length-1;m>=0;m--){const g=s[m];if(g.href===c&&(!d||g.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${c}"]${u}`))return;const p=document.createElement("link");if(p.rel=d?"stylesheet":hf,d||(p.as="script"),p.crossOrigin="",p.href=c,l&&p.setAttribute("nonce",l),document.head.appendChild(p),d)return new Promise((m,g)=>{p.addEventListener("load",m),p.addEventListener("error",()=>g(new Error(`Unable to preload CSS for ${c}`)))})}))}function r(s){const a=new Event("vite:preloadError",{cancelable:!0});if(a.payload=s,window.dispatchEvent(a),!a.defaultPrevented)throw s}return o.then(s=>{for(const a of s||[])a.status==="rejected"&&r(a.reason);return e().catch(r)})};No.line={worldUnits:{value:1},linewidth:{value:1},resolution:{value:new xr(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}};Bo.line={uniforms:pd.merge([No.common,No.fog,No.line]),vertexShader:`
		#include <common>
		#include <color_pars_vertex>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>
		#include <clipping_planes_pars_vertex>

		uniform float linewidth;
		uniform vec2 resolution;

		attribute vec3 instanceStart;
		attribute vec3 instanceEnd;

		attribute vec3 instanceColorStart;
		attribute vec3 instanceColorEnd;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#ifdef USE_DASH

			uniform float dashScale;
			attribute float instanceDistanceStart;
			attribute float instanceDistanceEnd;
			varying float vLineDistance;

		#endif

		void trimSegment( const in vec4 start, inout vec4 end ) {

			// trim end segment so it terminates between the camera plane and the near plane

			// conservative estimate of the near plane
			float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
			float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
			float nearEstimate = - 0.5 * b / a;

			float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

			end.xyz = mix( start.xyz, end.xyz, alpha );

		}

		void main() {

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

			#endif

			#ifdef USE_DASH

				vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
				vUv = uv;

			#endif

			float aspect = resolution.x / resolution.y;

			// camera space
			vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
			vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

			#ifdef WORLD_UNITS

				worldStart = start.xyz;
				worldEnd = end.xyz;

			#else

				vUv = uv;

			#endif

			// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
			// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
			// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
			// perhaps there is a more elegant solution -- WestLangley

			bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

			if ( perspective ) {

				if ( start.z < 0.0 && end.z >= 0.0 ) {

					trimSegment( start, end );

				} else if ( end.z < 0.0 && start.z >= 0.0 ) {

					trimSegment( end, start );

				}

			}

			// clip space
			vec4 clipStart = projectionMatrix * start;
			vec4 clipEnd = projectionMatrix * end;

			// ndc space
			vec3 ndcStart = clipStart.xyz / clipStart.w;
			vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

			// direction
			vec2 dir = ndcEnd.xy - ndcStart.xy;

			// account for clip-space aspect ratio
			dir.x *= aspect;
			dir = normalize( dir );

			#ifdef WORLD_UNITS

				vec3 worldDir = normalize( end.xyz - start.xyz );
				vec3 tmpFwd = normalize( mix( start.xyz, end.xyz, 0.5 ) );
				vec3 worldUp = normalize( cross( worldDir, tmpFwd ) );
				vec3 worldFwd = cross( worldDir, worldUp );
				worldPos = position.y < 0.5 ? start: end;

				// height offset
				float hw = linewidth * 0.5;
				worldPos.xyz += position.x < 0.0 ? hw * worldUp : - hw * worldUp;

				// don't extend the line if we're rendering dashes because we
				// won't be rendering the endcaps
				#ifndef USE_DASH

					// cap extension
					worldPos.xyz += position.y < 0.5 ? - hw * worldDir : hw * worldDir;

					// add width to the box
					worldPos.xyz += worldFwd * hw;

					// endcaps
					if ( position.y > 1.0 || position.y < 0.0 ) {

						worldPos.xyz -= worldFwd * 2.0 * hw;

					}

				#endif

				// project the worldpos
				vec4 clip = projectionMatrix * worldPos;

				// shift the depth of the projected points so the line
				// segments overlap neatly
				vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
				clip.z = clipPose.z * clip.w;

			#else

				vec2 offset = vec2( dir.y, - dir.x );
				// undo aspect ratio adjustment
				dir.x /= aspect;
				offset.x /= aspect;

				// sign flip
				if ( position.x < 0.0 ) offset *= - 1.0;

				// endcaps
				if ( position.y < 0.0 ) {

					offset += - dir;

				} else if ( position.y > 1.0 ) {

					offset += dir;

				}

				// adjust for linewidth
				offset *= linewidth;

				// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
				offset /= resolution.y;

				// select end
				vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

				// back to clip space
				offset *= clip.w;

				clip.xy += offset;

			#endif

			gl_Position = clip;

			vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

			#include <logdepthbuf_vertex>
			#include <clipping_planes_vertex>
			#include <fog_vertex>

		}
		`,fragmentShader:`
		uniform vec3 diffuse;
		uniform float opacity;
		uniform float linewidth;

		#ifdef USE_DASH

			uniform float dashOffset;
			uniform float dashSize;
			uniform float gapSize;

		#endif

		varying float vLineDistance;

		#ifdef WORLD_UNITS

			varying vec4 worldPos;
			varying vec3 worldStart;
			varying vec3 worldEnd;

			#ifdef USE_DASH

				varying vec2 vUv;

			#endif

		#else

			varying vec2 vUv;

		#endif

		#include <common>
		#include <color_pars_fragment>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>
		#include <clipping_planes_pars_fragment>

		vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

			float mua;
			float mub;

			vec3 p13 = p1 - p3;
			vec3 p43 = p4 - p3;

			vec3 p21 = p2 - p1;

			float d1343 = dot( p13, p43 );
			float d4321 = dot( p43, p21 );
			float d1321 = dot( p13, p21 );
			float d4343 = dot( p43, p43 );
			float d2121 = dot( p21, p21 );

			float denom = d2121 * d4343 - d4321 * d4321;

			float numer = d1343 * d4321 - d1321 * d4343;

			mua = numer / denom;
			mua = clamp( mua, 0.0, 1.0 );
			mub = ( d1343 + d4321 * ( mua ) ) / d4343;
			mub = clamp( mub, 0.0, 1.0 );

			return vec2( mua, mub );

		}

		void main() {

			#include <clipping_planes_fragment>

			#ifdef USE_DASH

				if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

				if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

			#endif

			float alpha = opacity;

			#ifdef WORLD_UNITS

				// Find the closest points on the view ray and the line segment
				vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
				vec3 lineDir = worldEnd - worldStart;
				vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

				vec3 p1 = worldStart + lineDir * params.x;
				vec3 p2 = rayEnd * params.y;
				vec3 delta = p1 - p2;
				float len = length( delta );
				float norm = len / linewidth;

				#ifndef USE_DASH

					#ifdef USE_ALPHA_TO_COVERAGE

						float dnorm = fwidth( norm );
						alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

					#else

						if ( norm > 0.5 ) {

							discard;

						}

					#endif

				#endif

			#else

				#ifdef USE_ALPHA_TO_COVERAGE

					// artifacts appear on some hardware if a derivative is taken within a conditional
					float a = vUv.x;
					float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
					float len2 = a * a + b * b;
					float dlen = fwidth( len2 );

					if ( abs( vUv.y ) > 1.0 ) {

						alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

					}

				#else

					if ( abs( vUv.y ) > 1.0 ) {

						float a = vUv.x;
						float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
						float len2 = a * a + b * b;

						if ( len2 > 1.0 ) discard;

					}

				#endif

			#endif

			vec4 diffuseColor = vec4( diffuse, alpha );

			#include <logdepthbuf_fragment>
			#include <color_fragment>

			gl_FragColor = vec4( diffuseColor.rgb, alpha );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>
			#include <fog_fragment>
			#include <premultiplied_alpha_fragment>

		}
		`};class mf extends Kp{constructor(e){super({type:"LineMaterial",uniforms:pd.clone(Bo.line.uniforms),vertexShader:Bo.line.vertexShader,fragmentShader:Bo.line.fragmentShader,clipping:!0}),this.isLineMaterial=!0,this.setValues(e)}get color(){return this.uniforms.diffuse.value}set color(e){this.uniforms.diffuse.value=e}get worldUnits(){return"WORLD_UNITS"in this.defines}set worldUnits(e){e===!0?this.defines.WORLD_UNITS="":delete this.defines.WORLD_UNITS}get linewidth(){return this.uniforms.linewidth.value}set linewidth(e){this.uniforms.linewidth&&(this.uniforms.linewidth.value=e)}get dashed(){return"USE_DASH"in this.defines}set dashed(e){e===!0!==this.dashed&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH="":delete this.defines.USE_DASH}get dashScale(){return this.uniforms.dashScale.value}set dashScale(e){this.uniforms.dashScale.value=e}get dashSize(){return this.uniforms.dashSize.value}set dashSize(e){this.uniforms.dashSize.value=e}get dashOffset(){return this.uniforms.dashOffset.value}set dashOffset(e){this.uniforms.dashOffset.value=e}get gapSize(){return this.uniforms.gapSize.value}set gapSize(e){this.uniforms.gapSize.value=e}get opacity(){return this.uniforms.opacity.value}set opacity(e){this.uniforms&&(this.uniforms.opacity.value=e)}get resolution(){return this.uniforms.resolution.value}set resolution(e){this.uniforms.resolution.value.copy(e)}get alphaToCoverage(){return"USE_ALPHA_TO_COVERAGE"in this.defines}set alphaToCoverage(e){this.defines&&(e===!0!==this.alphaToCoverage&&(this.needsUpdate=!0),e===!0?this.defines.USE_ALPHA_TO_COVERAGE="":delete this.defines.USE_ALPHA_TO_COVERAGE)}}var bf=Object.defineProperty,gf=(t,e,i)=>e in t?bf(t,e,{enumerable:!0,configurable:!0,writable:!0,value:i}):t[e]=i,ni=(t,e,i)=>(gf(t,typeof e!="symbol"?e+"":e,i),i);const Wi=Math.min,St=Math.max,Zo=Math.round,Nt=t=>({x:t,y:t}),yf={left:"right",right:"left",bottom:"top",top:"bottom"},vf={start:"end",end:"start"};function yl(t,e,i){return St(t,Wi(e,i))}function uo(t,e){return typeof t=="function"?t(e):t}function kt(t){return t.split("-")[0]}function kr(t){return t.split("-")[1]}function bd(t){return t==="x"?"y":"x"}function gd(t){return t==="y"?"height":"width"}const wf=new Set(["top","bottom"]);function xt(t){return wf.has(kt(t))?"y":"x"}function yd(t){return bd(xt(t))}function $f(t,e,i){i===void 0&&(i=!1);const n=kr(t),o=yd(t),r=gd(o);let s=o==="x"?n===(i?"end":"start")?"right":"left":n==="start"?"bottom":"top";return e.reference[r]>e.floating[r]&&(s=Jo(s)),[s,Jo(s)]}function _f(t){const e=Jo(t);return[ks(t),e,ks(e)]}function ks(t){return t.replace(/start|end/g,e=>vf[e])}const vl=["left","right"],wl=["right","left"],xf=["top","bottom"],Ef=["bottom","top"];function Sf(t,e,i){switch(t){case"top":case"bottom":return i?e?wl:vl:e?vl:wl;case"left":case"right":return e?xf:Ef;default:return[]}}function Af(t,e,i,n){const o=kr(t);let r=Sf(kt(t),i==="start",n);return o&&(r=r.map(s=>s+"-"+o),e&&(r=r.concat(r.map(ks)))),r}function Jo(t){return t.replace(/left|right|bottom|top/g,e=>yf[e])}function Cf(t){return{top:0,right:0,bottom:0,left:0,...t}}function vd(t){return typeof t!="number"?Cf(t):{top:t,right:t,bottom:t,left:t}}function Yi(t){const{x:e,y:i,width:n,height:o}=t;return{width:n,height:o,top:i,left:e,right:e+n,bottom:i+o,x:e,y:i}}function $l(t,e,i){let{reference:n,floating:o}=t;const r=xt(e),s=yd(e),a=gd(s),l=kt(e),c=r==="y",d=n.x+n.width/2-o.width/2,u=n.y+n.height/2-o.height/2,h=n[a]/2-o[a]/2;let p;switch(l){case"top":p={x:d,y:n.y-o.height};break;case"bottom":p={x:d,y:n.y+n.height};break;case"right":p={x:n.x+n.width,y:u};break;case"left":p={x:n.x-o.width,y:u};break;default:p={x:n.x,y:n.y}}switch(kr(e)){case"start":p[s]-=h*(i&&c?-1:1);break;case"end":p[s]+=h*(i&&c?-1:1);break}return p}const kf=async(t,e,i)=>{const{placement:n="bottom",strategy:o="absolute",middleware:r=[],platform:s}=i,a=r.filter(Boolean),l=await(s.isRTL==null?void 0:s.isRTL(e));let c=await s.getElementRects({reference:t,floating:e,strategy:o}),{x:d,y:u}=$l(c,n,l),h=n,p={},m=0;for(let g=0;g<a.length;g++){const{name:f,fn:v}=a[g],{x:b,y,data:$,reset:A}=await v({x:d,y:u,initialPlacement:n,placement:h,strategy:o,middlewareData:p,rects:c,platform:s,elements:{reference:t,floating:e}});d=b??d,u=y??u,p={...p,[f]:{...p[f],...$}},A&&m<=50&&(m++,typeof A=="object"&&(A.placement&&(h=A.placement),A.rects&&(c=A.rects===!0?await s.getElementRects({reference:t,floating:e,strategy:o}):A.rects),{x:d,y:u}=$l(c,h,l)),g=-1)}return{x:d,y:u,placement:h,strategy:o,middlewareData:p}};async function wd(t,e){var i;e===void 0&&(e={});const{x:n,y:o,platform:r,rects:s,elements:a,strategy:l}=t,{boundary:c="clippingAncestors",rootBoundary:d="viewport",elementContext:u="floating",altBoundary:h=!1,padding:p=0}=uo(e,t),m=vd(p),g=a[h?u==="floating"?"reference":"floating":u],f=Yi(await r.getClippingRect({element:(i=await(r.isElement==null?void 0:r.isElement(g)))==null||i?g:g.contextElement||await(r.getDocumentElement==null?void 0:r.getDocumentElement(a.floating)),boundary:c,rootBoundary:d,strategy:l})),v=u==="floating"?{x:n,y:o,width:s.floating.width,height:s.floating.height}:s.reference,b=await(r.getOffsetParent==null?void 0:r.getOffsetParent(a.floating)),y=await(r.isElement==null?void 0:r.isElement(b))?await(r.getScale==null?void 0:r.getScale(b))||{x:1,y:1}:{x:1,y:1},$=Yi(r.convertOffsetParentRelativeRectToViewportRelativeRect?await r.convertOffsetParentRelativeRectToViewportRelativeRect({elements:a,rect:v,offsetParent:b,strategy:l}):v);return{top:(f.top-$.top+m.top)/y.y,bottom:($.bottom-f.bottom+m.bottom)/y.y,left:(f.left-$.left+m.left)/y.x,right:($.right-f.right+m.right)/y.x}}const Tf=function(t){return t===void 0&&(t={}),{name:"flip",options:t,async fn(e){var i,n;const{placement:o,middlewareData:r,rects:s,initialPlacement:a,platform:l,elements:c}=e,{mainAxis:d=!0,crossAxis:u=!0,fallbackPlacements:h,fallbackStrategy:p="bestFit",fallbackAxisSideDirection:m="none",flipAlignment:g=!0,...f}=uo(t,e);if((i=r.arrow)!=null&&i.alignmentOffset)return{};const v=kt(o),b=xt(a),y=kt(a)===a,$=await(l.isRTL==null?void 0:l.isRTL(c.floating)),A=h||(y||!g?[Jo(a)]:_f(a)),E=m!=="none";!h&&E&&A.push(...Af(a,g,m,$));const O=[a,...A],D=await wd(e,f),P=[];let T=((n=r.flip)==null?void 0:n.overflows)||[];if(d&&P.push(D[v]),u){const I=$f(o,s,$);P.push(D[I[0]],D[I[1]])}if(T=[...T,{placement:o,overflows:P}],!P.every(I=>I<=0)){var Y,B;const I=(((Y=r.flip)==null?void 0:Y.index)||0)+1,U=O[I];if(U&&(!(u==="alignment"&&b!==xt(U))||T.every(X=>xt(X.placement)===b?X.overflows[0]>0:!0)))return{data:{index:I,overflows:T},reset:{placement:U}};let te=(B=T.filter(X=>X.overflows[0]<=0).sort((X,H)=>X.overflows[1]-H.overflows[1])[0])==null?void 0:B.placement;if(!te)switch(p){case"bestFit":{var ae;const X=(ae=T.filter(H=>{if(E){const q=xt(H.placement);return q===b||q==="y"}return!0}).map(H=>[H.placement,H.overflows.filter(q=>q>0).reduce((q,fe)=>q+fe,0)]).sort((H,q)=>H[1]-q[1])[0])==null?void 0:ae[0];X&&(te=X);break}case"initialPlacement":te=a;break}if(o!==te)return{reset:{placement:te}}}return{}}}};function $d(t){const e=Wi(...t.map(r=>r.left)),i=Wi(...t.map(r=>r.top)),n=St(...t.map(r=>r.right)),o=St(...t.map(r=>r.bottom));return{x:e,y:i,width:n-e,height:o-i}}function Of(t){const e=t.slice().sort((o,r)=>o.y-r.y),i=[];let n=null;for(let o=0;o<e.length;o++){const r=e[o];!n||r.y-n.y>n.height/2?i.push([r]):i[i.length-1].push(r),n=r}return i.map(o=>Yi($d(o)))}const If=function(t){return t===void 0&&(t={}),{name:"inline",options:t,async fn(e){const{placement:i,elements:n,rects:o,platform:r,strategy:s}=e,{padding:a=2,x:l,y:c}=uo(t,e),d=Array.from(await(r.getClientRects==null?void 0:r.getClientRects(n.reference))||[]),u=Of(d),h=Yi($d(d)),p=vd(a);function m(){if(u.length===2&&u[0].left>u[1].right&&l!=null&&c!=null)return u.find(f=>l>f.left-p.left&&l<f.right+p.right&&c>f.top-p.top&&c<f.bottom+p.bottom)||h;if(u.length>=2){if(xt(i)==="y"){const T=u[0],Y=u[u.length-1],B=kt(i)==="top",ae=T.top,I=Y.bottom,U=B?T.left:Y.left,te=B?T.right:Y.right,X=te-U,H=I-ae;return{top:ae,bottom:I,left:U,right:te,width:X,height:H,x:U,y:ae}}const f=kt(i)==="left",v=St(...u.map(T=>T.right)),b=Wi(...u.map(T=>T.left)),y=u.filter(T=>f?T.left===b:T.right===v),$=y[0].top,A=y[y.length-1].bottom,E=b,O=v,D=O-E,P=A-$;return{top:$,bottom:A,left:E,right:O,width:D,height:P,x:E,y:$}}return h}const g=await r.getElementRects({reference:{getBoundingClientRect:m},floating:n.floating,strategy:s});return o.reference.x!==g.reference.x||o.reference.y!==g.reference.y||o.reference.width!==g.reference.width||o.reference.height!==g.reference.height?{reset:{rects:g}}:{}}}},Pf=new Set(["left","top"]);async function zf(t,e){const{placement:i,platform:n,elements:o}=t,r=await(n.isRTL==null?void 0:n.isRTL(o.floating)),s=kt(i),a=kr(i),l=xt(i)==="y",c=Pf.has(s)?-1:1,d=r&&l?-1:1,u=uo(e,t);let{mainAxis:h,crossAxis:p,alignmentAxis:m}=typeof u=="number"?{mainAxis:u,crossAxis:0,alignmentAxis:null}:{mainAxis:u.mainAxis||0,crossAxis:u.crossAxis||0,alignmentAxis:u.alignmentAxis};return a&&typeof m=="number"&&(p=a==="end"?m*-1:m),l?{x:p*d,y:h*c}:{x:h*c,y:p*d}}const ma=function(t){return{name:"offset",options:t,async fn(e){var i,n;const{x:o,y:r,placement:s,middlewareData:a}=e,l=await zf(e,t);return s===((i=a.offset)==null?void 0:i.placement)&&(n=a.arrow)!=null&&n.alignmentOffset?{}:{x:o+l.x,y:r+l.y,data:{...l,placement:s}}}}},Lf=function(t){return t===void 0&&(t={}),{name:"shift",options:t,async fn(e){const{x:i,y:n,placement:o}=e,{mainAxis:r=!0,crossAxis:s=!1,limiter:a={fn:f=>{let{x:v,y:b}=f;return{x:v,y:b}}},...l}=uo(t,e),c={x:i,y:n},d=await wd(e,l),u=xt(kt(o)),h=bd(u);let p=c[h],m=c[u];if(r){const f=h==="y"?"top":"left",v=h==="y"?"bottom":"right",b=p+d[f],y=p-d[v];p=yl(b,p,y)}if(s){const f=u==="y"?"top":"left",v=u==="y"?"bottom":"right",b=m+d[f],y=m-d[v];m=yl(b,m,y)}const g=a.fn({...e,[h]:p,[u]:m});return{...g,data:{x:g.x-i,y:g.y-n,enabled:{[h]:r,[u]:s}}}}}};function Tr(){return typeof window<"u"}function Ft(t){return _d(t)?(t.nodeName||"").toLowerCase():"#document"}function De(t){var e;return(t==null||(e=t.ownerDocument)==null?void 0:e.defaultView)||window}function Gt(t){var e;return(e=(_d(t)?t.ownerDocument:t.document)||window.document)==null?void 0:e.documentElement}function _d(t){return Tr()?t instanceof Node||t instanceof De(t).Node:!1}function pt(t){return Tr()?t instanceof Element||t instanceof De(t).Element:!1}function ft(t){return Tr()?t instanceof HTMLElement||t instanceof De(t).HTMLElement:!1}function _l(t){return!Tr()||typeof ShadowRoot>"u"?!1:t instanceof ShadowRoot||t instanceof De(t).ShadowRoot}const Mf=new Set(["inline","contents"]);function ho(t){const{overflow:e,overflowX:i,overflowY:n,display:o}=Ve(t);return/auto|scroll|overlay|hidden|clip/.test(e+n+i)&&!Mf.has(o)}const Df=new Set(["table","td","th"]);function jf(t){return Df.has(Ft(t))}const Rf=[":popover-open",":modal"];function Bf(t){return Rf.some(e=>{try{return t.matches(e)}catch{return!1}})}const Nf=["transform","translate","scale","rotate","perspective"],Ff=["transform","translate","scale","rotate","perspective","filter"],Uf=["paint","layout","strict","content"];function ba(t){const e=ga(),i=pt(t)?Ve(t):t;return Nf.some(n=>i[n]?i[n]!=="none":!1)||(i.containerType?i.containerType!=="normal":!1)||!e&&(i.backdropFilter?i.backdropFilter!=="none":!1)||!e&&(i.filter?i.filter!=="none":!1)||Ff.some(n=>(i.willChange||"").includes(n))||Uf.some(n=>(i.contain||"").includes(n))}function Hf(t){let e=Xi(t);for(;ft(e)&&!Or(e);){if(ba(e))return e;if(Bf(e))return null;e=Xi(e)}return null}function ga(){return typeof CSS>"u"||!CSS.supports?!1:CSS.supports("-webkit-backdrop-filter","none")}const qf=new Set(["html","body","#document"]);function Or(t){return qf.has(Ft(t))}function Ve(t){return De(t).getComputedStyle(t)}function Ir(t){return pt(t)?{scrollLeft:t.scrollLeft,scrollTop:t.scrollTop}:{scrollLeft:t.scrollX,scrollTop:t.scrollY}}function Xi(t){if(Ft(t)==="html")return t;const e=t.assignedSlot||t.parentNode||_l(t)&&t.host||Gt(t);return _l(e)?e.host:e}function xd(t){const e=Xi(t);return Or(e)?t.ownerDocument?t.ownerDocument.body:t.body:ft(e)&&ho(e)?e:xd(e)}function Ed(t,e,i){var n;e===void 0&&(e=[]);const o=xd(t),r=o===((n=t.ownerDocument)==null?void 0:n.body),s=De(o);return r?(Vf(s),e.concat(s,s.visualViewport||[],ho(o)?o:[],[])):e.concat(o,Ed(o,[]))}function Vf(t){return t.parent&&Object.getPrototypeOf(t.parent)?t.frameElement:null}function Sd(t){const e=Ve(t);let i=parseFloat(e.width)||0,n=parseFloat(e.height)||0;const o=ft(t),r=o?t.offsetWidth:i,s=o?t.offsetHeight:n,a=Zo(i)!==r||Zo(n)!==s;return a&&(i=r,n=s),{width:i,height:n,$:a}}function Ad(t){return pt(t)?t:t.contextElement}function Ni(t){const e=Ad(t);if(!ft(e))return Nt(1);const i=e.getBoundingClientRect(),{width:n,height:o,$:r}=Sd(e);let s=(r?Zo(i.width):i.width)/n,a=(r?Zo(i.height):i.height)/o;return(!s||!Number.isFinite(s))&&(s=1),(!a||!Number.isFinite(a))&&(a=1),{x:s,y:a}}const Gf=Nt(0);function Cd(t){const e=De(t);return!ga()||!e.visualViewport?Gf:{x:e.visualViewport.offsetLeft,y:e.visualViewport.offsetTop}}function Wf(t,e,i){return e===void 0&&(e=!1),!i||e&&i!==De(t)?!1:e}function Hn(t,e,i,n){e===void 0&&(e=!1),i===void 0&&(i=!1);const o=t.getBoundingClientRect(),r=Ad(t);let s=Nt(1);e&&(n?pt(n)&&(s=Ni(n)):s=Ni(t));const a=Wf(r,i,n)?Cd(r):Nt(0);let l=(o.left+a.x)/s.x,c=(o.top+a.y)/s.y,d=o.width/s.x,u=o.height/s.y;if(r){const h=De(r),p=n&&pt(n)?De(n):n;let m=h,g=m.frameElement;for(;g&&n&&p!==m;){const f=Ni(g),v=g.getBoundingClientRect(),b=Ve(g),y=v.left+(g.clientLeft+parseFloat(b.paddingLeft))*f.x,$=v.top+(g.clientTop+parseFloat(b.paddingTop))*f.y;l*=f.x,c*=f.y,d*=f.x,u*=f.y,l+=y,c+=$,m=De(g),g=m.frameElement}}return Yi({width:d,height:u,x:l,y:c})}const Yf=[":popover-open",":modal"];function kd(t){return Yf.some(e=>{try{return t.matches(e)}catch{return!1}})}function Xf(t){let{elements:e,rect:i,offsetParent:n,strategy:o}=t;const r=o==="fixed",s=Gt(n),a=e?kd(e.floating):!1;if(n===s||a&&r)return i;let l={scrollLeft:0,scrollTop:0},c=Nt(1);const d=Nt(0),u=ft(n);if((u||!u&&!r)&&((Ft(n)!=="body"||ho(s))&&(l=Ir(n)),ft(n))){const h=Hn(n);c=Ni(n),d.x=h.x+n.clientLeft,d.y=h.y+n.clientTop}return{width:i.width*c.x,height:i.height*c.y,x:i.x*c.x-l.scrollLeft*c.x+d.x,y:i.y*c.y-l.scrollTop*c.y+d.y}}function Zf(t){return Array.from(t.getClientRects())}function Td(t){return Hn(Gt(t)).left+Ir(t).scrollLeft}function Jf(t){const e=Gt(t),i=Ir(t),n=t.ownerDocument.body,o=St(e.scrollWidth,e.clientWidth,n.scrollWidth,n.clientWidth),r=St(e.scrollHeight,e.clientHeight,n.scrollHeight,n.clientHeight);let s=-i.scrollLeft+Td(t);const a=-i.scrollTop;return Ve(n).direction==="rtl"&&(s+=St(e.clientWidth,n.clientWidth)-o),{width:o,height:r,x:s,y:a}}function Kf(t,e){const i=De(t),n=Gt(t),o=i.visualViewport;let r=n.clientWidth,s=n.clientHeight,a=0,l=0;if(o){r=o.width,s=o.height;const c=ga();(!c||c&&e==="fixed")&&(a=o.offsetLeft,l=o.offsetTop)}return{width:r,height:s,x:a,y:l}}function Qf(t,e){const i=Hn(t,!0,e==="fixed"),n=i.top+t.clientTop,o=i.left+t.clientLeft,r=ft(t)?Ni(t):Nt(1),s=t.clientWidth*r.x,a=t.clientHeight*r.y,l=o*r.x,c=n*r.y;return{width:s,height:a,x:l,y:c}}function xl(t,e,i){let n;if(e==="viewport")n=Kf(t,i);else if(e==="document")n=Jf(Gt(t));else if(pt(e))n=Qf(e,i);else{const o=Cd(t);n={...e,x:e.x-o.x,y:e.y-o.y}}return Yi(n)}function Od(t,e){const i=Xi(t);return i===e||!pt(i)||Or(i)?!1:Ve(i).position==="fixed"||Od(i,e)}function em(t,e){const i=e.get(t);if(i)return i;let n=Ed(t,[]).filter(a=>pt(a)&&Ft(a)!=="body"),o=null;const r=Ve(t).position==="fixed";let s=r?Xi(t):t;for(;pt(s)&&!Or(s);){const a=Ve(s),l=ba(s);!l&&a.position==="fixed"&&(o=null),(r?!l&&!o:!l&&a.position==="static"&&o&&["absolute","fixed"].includes(o.position)||ho(s)&&!l&&Od(t,s))?n=n.filter(c=>c!==s):o=a,s=Xi(s)}return e.set(t,n),n}function tm(t){let{element:e,boundary:i,rootBoundary:n,strategy:o}=t;const r=[...i==="clippingAncestors"?em(e,this._c):[].concat(i),n],s=r[0],a=r.reduce((l,c)=>{const d=xl(e,c,o);return l.top=St(d.top,l.top),l.right=Wi(d.right,l.right),l.bottom=Wi(d.bottom,l.bottom),l.left=St(d.left,l.left),l},xl(e,s,o));return{width:a.right-a.left,height:a.bottom-a.top,x:a.left,y:a.top}}function im(t){const{width:e,height:i}=Sd(t);return{width:e,height:i}}function nm(t,e,i){const n=ft(e),o=Gt(e),r=i==="fixed",s=Hn(t,!0,r,e);let a={scrollLeft:0,scrollTop:0};const l=Nt(0);if(n||!n&&!r)if((Ft(e)!=="body"||ho(o))&&(a=Ir(e)),n){const u=Hn(e,!0,r,e);l.x=u.x+e.clientLeft,l.y=u.y+e.clientTop}else o&&(l.x=Td(o));const c=s.left+a.scrollLeft-l.x,d=s.top+a.scrollTop-l.y;return{x:c,y:d,width:s.width,height:s.height}}function El(t,e){return!ft(t)||Ve(t).position==="fixed"?null:e?e(t):t.offsetParent}function Id(t,e){const i=De(t);if(!ft(t)||kd(t))return i;let n=El(t,e);for(;n&&jf(n)&&Ve(n).position==="static";)n=El(n,e);return n&&(Ft(n)==="html"||Ft(n)==="body"&&Ve(n).position==="static"&&!ba(n))?i:n||Hf(t)||i}const om=async function(t){const e=this.getOffsetParent||Id,i=this.getDimensions;return{reference:nm(t.reference,await e(t.floating),t.strategy),floating:{x:0,y:0,...await i(t.floating)}}};function rm(t){return Ve(t).direction==="rtl"}const sm={convertOffsetParentRelativeRectToViewportRelativeRect:Xf,getDocumentElement:Gt,getClippingRect:tm,getOffsetParent:Id,getElementRects:om,getClientRects:Zf,getDimensions:im,getScale:Ni,isElement:pt,isRTL:rm},ya=Lf,va=Tf,wa=If,$a=(t,e,i)=>{const n=new Map,o={platform:sm,...i},r={...o.platform,_c:n};return kf(t,e,{...o,platform:r})};/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Fo=globalThis,_a=Fo.ShadowRoot&&(Fo.ShadyCSS===void 0||Fo.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,xa=Symbol(),Sl=new WeakMap;let Pd=class{constructor(e,i,n){if(this._$cssResult$=!0,n!==xa)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=i}get styleSheet(){let e=this.o;const i=this.t;if(_a&&e===void 0){const n=i!==void 0&&i.length===1;n&&(e=Sl.get(i)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),n&&Sl.set(i,e))}return e}toString(){return this.cssText}};const am=t=>new Pd(typeof t=="string"?t:t+"",void 0,xa),Q=(t,...e)=>{const i=t.length===1?t[0]:e.reduce((n,o,r)=>n+(s=>{if(s._$cssResult$===!0)return s.cssText;if(typeof s=="number")return s;throw Error("Value passed to 'css' function must be a 'css' function result: "+s+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(o)+t[r+1],t[0]);return new Pd(i,t,xa)},lm=(t,e)=>{if(_a)t.adoptedStyleSheets=e.map(i=>i instanceof CSSStyleSheet?i:i.styleSheet);else for(const i of e){const n=document.createElement("style"),o=Fo.litNonce;o!==void 0&&n.setAttribute("nonce",o),n.textContent=i.cssText,t.appendChild(n)}},Al=_a?t=>t:t=>t instanceof CSSStyleSheet?(e=>{let i="";for(const n of e.cssRules)i+=n.cssText;return am(i)})(t):t;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:cm,defineProperty:dm,getOwnPropertyDescriptor:um,getOwnPropertyNames:hm,getOwnPropertySymbols:pm,getPrototypeOf:fm}=Object,Zi=globalThis,Cl=Zi.trustedTypes,mm=Cl?Cl.emptyScript:"",kl=Zi.reactiveElementPolyfillSupport,Pn=(t,e)=>t,Ko={toAttribute(t,e){switch(e){case Boolean:t=t?mm:null;break;case Object:case Array:t=t==null?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=t!==null;break;case Number:i=t===null?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch{i=null}}return i}},Ea=(t,e)=>!cm(t,e),Tl={attribute:!0,type:String,converter:Ko,reflect:!1,useDefault:!1,hasChanged:Ea};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),Zi.litPropertyMetadata??(Zi.litPropertyMetadata=new WeakMap);let Li=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??(this.l=[])).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,i=Tl){if(i.state&&(i.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((i=Object.create(i)).wrapped=!0),this.elementProperties.set(e,i),!i.noAccessor){const n=Symbol(),o=this.getPropertyDescriptor(e,n,i);o!==void 0&&dm(this.prototype,e,o)}}static getPropertyDescriptor(e,i,n){const{get:o,set:r}=um(this.prototype,e)??{get(){return this[i]},set(s){this[i]=s}};return{get:o,set(s){const a=o?.call(this);r?.call(this,s),this.requestUpdate(e,a,n)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??Tl}static _$Ei(){if(this.hasOwnProperty(Pn("elementProperties")))return;const e=fm(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(Pn("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Pn("properties"))){const i=this.properties,n=[...hm(i),...pm(i)];for(const o of n)this.createProperty(o,i[o])}const e=this[Symbol.metadata];if(e!==null){const i=litPropertyMetadata.get(e);if(i!==void 0)for(const[n,o]of i)this.elementProperties.set(n,o)}this._$Eh=new Map;for(const[i,n]of this.elementProperties){const o=this._$Eu(i,n);o!==void 0&&this._$Eh.set(o,i)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const i=[];if(Array.isArray(e)){const n=new Set(e.flat(1/0).reverse());for(const o of n)i.unshift(Al(o))}else e!==void 0&&i.push(Al(e));return i}static _$Eu(e,i){const n=i.attribute;return n===!1?void 0:typeof n=="string"?n:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var e;this._$ES=new Promise(i=>this.enableUpdating=i),this._$AL=new Map,this._$E_(),this.requestUpdate(),(e=this.constructor.l)==null||e.forEach(i=>i(this))}addController(e){var i;(this._$EO??(this._$EO=new Set)).add(e),this.renderRoot!==void 0&&this.isConnected&&((i=e.hostConnected)==null||i.call(e))}removeController(e){var i;(i=this._$EO)==null||i.delete(e)}_$E_(){const e=new Map,i=this.constructor.elementProperties;for(const n of i.keys())this.hasOwnProperty(n)&&(e.set(n,this[n]),delete this[n]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return lm(e,this.constructor.elementStyles),e}connectedCallback(){var e;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(e=this._$EO)==null||e.forEach(i=>{var n;return(n=i.hostConnected)==null?void 0:n.call(i)})}enableUpdating(e){}disconnectedCallback(){var e;(e=this._$EO)==null||e.forEach(i=>{var n;return(n=i.hostDisconnected)==null?void 0:n.call(i)})}attributeChangedCallback(e,i,n){this._$AK(e,n)}_$ET(e,i){var n;const o=this.constructor.elementProperties.get(e),r=this.constructor._$Eu(e,o);if(r!==void 0&&o.reflect===!0){const s=(((n=o.converter)==null?void 0:n.toAttribute)!==void 0?o.converter:Ko).toAttribute(i,o.type);this._$Em=e,s==null?this.removeAttribute(r):this.setAttribute(r,s),this._$Em=null}}_$AK(e,i){var n,o;const r=this.constructor,s=r._$Eh.get(e);if(s!==void 0&&this._$Em!==s){const a=r.getPropertyOptions(s),l=typeof a.converter=="function"?{fromAttribute:a.converter}:((n=a.converter)==null?void 0:n.fromAttribute)!==void 0?a.converter:Ko;this._$Em=s;const c=l.fromAttribute(i,a.type);this[s]=c??((o=this._$Ej)==null?void 0:o.get(s))??c,this._$Em=null}}requestUpdate(e,i,n,o=!1,r){var s;if(e!==void 0){const a=this.constructor;if(o===!1&&(r=this[e]),n??(n=a.getPropertyOptions(e)),!((n.hasChanged??Ea)(r,i)||n.useDefault&&n.reflect&&r===((s=this._$Ej)==null?void 0:s.get(e))&&!this.hasAttribute(a._$Eu(e,n))))return;this.C(e,i,n)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,i,{useDefault:n,reflect:o,wrapped:r},s){n&&!(this._$Ej??(this._$Ej=new Map)).has(e)&&(this._$Ej.set(e,s??i??this[e]),r!==!0||s!==void 0)||(this._$AL.has(e)||(this.hasUpdated||n||(i=void 0),this._$AL.set(e,i)),o===!0&&this._$Em!==e&&(this._$Eq??(this._$Eq=new Set)).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(i){Promise.reject(i)}const e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var e;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[r,s]of this._$Ep)this[r]=s;this._$Ep=void 0}const o=this.constructor.elementProperties;if(o.size>0)for(const[r,s]of o){const{wrapped:a}=s,l=this[r];a!==!0||this._$AL.has(r)||l===void 0||this.C(r,void 0,s,l)}}let i=!1;const n=this._$AL;try{i=this.shouldUpdate(n),i?(this.willUpdate(n),(e=this._$EO)==null||e.forEach(o=>{var r;return(r=o.hostUpdate)==null?void 0:r.call(o)}),this.update(n)):this._$EM()}catch(o){throw i=!1,this._$EM(),o}i&&this._$AE(n)}willUpdate(e){}_$AE(e){var i;(i=this._$EO)==null||i.forEach(n=>{var o;return(o=n.hostUpdated)==null?void 0:o.call(n)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&(this._$Eq=this._$Eq.forEach(i=>this._$ET(i,this[i]))),this._$EM()}updated(e){}firstUpdated(e){}};Li.elementStyles=[],Li.shadowRootOptions={mode:"open"},Li[Pn("elementProperties")]=new Map,Li[Pn("finalized")]=new Map,kl?.({ReactiveElement:Li}),(Zi.reactiveElementVersions??(Zi.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Qo=globalThis,Ol=t=>t,er=Qo.trustedTypes,Il=er?er.createPolicy("lit-html",{createHTML:t=>t}):void 0,zd="$lit$",Mt=`lit$${Math.random().toFixed(9).slice(2)}$`,Ld="?"+Mt,bm=`<${Ld}>`,vi=document,qn=()=>vi.createComment(""),Vn=t=>t===null||typeof t!="object"&&typeof t!="function",Sa=Array.isArray,gm=t=>Sa(t)||typeof t?.[Symbol.iterator]=="function",as=`[ 	
\f\r]`,Cn=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Pl=/-->/g,zl=/>/g,oi=RegExp(`>|${as}(?:([^\\s"'>=/]+)(${as}*=${as}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Ll=/'/g,Ml=/"/g,Md=/^(?:script|style|textarea|title)$/i,ym=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),C=ym(1),wi=Symbol.for("lit-noChange"),ie=Symbol.for("lit-nothing"),Dl=new WeakMap,ci=vi.createTreeWalker(vi,129);function Dd(t,e){if(!Sa(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return Il!==void 0?Il.createHTML(e):e}const vm=(t,e)=>{const i=t.length-1,n=[];let o,r=e===2?"<svg>":e===3?"<math>":"",s=Cn;for(let a=0;a<i;a++){const l=t[a];let c,d,u=-1,h=0;for(;h<l.length&&(s.lastIndex=h,d=s.exec(l),d!==null);)h=s.lastIndex,s===Cn?d[1]==="!--"?s=Pl:d[1]!==void 0?s=zl:d[2]!==void 0?(Md.test(d[2])&&(o=RegExp("</"+d[2],"g")),s=oi):d[3]!==void 0&&(s=oi):s===oi?d[0]===">"?(s=o??Cn,u=-1):d[1]===void 0?u=-2:(u=s.lastIndex-d[2].length,c=d[1],s=d[3]===void 0?oi:d[3]==='"'?Ml:Ll):s===Ml||s===Ll?s=oi:s===Pl||s===zl?s=Cn:(s=oi,o=void 0);const p=s===oi&&t[a+1].startsWith("/>")?" ":"";r+=s===Cn?l+bm:u>=0?(n.push(c),l.slice(0,u)+zd+l.slice(u)+Mt+p):l+Mt+(u===-2?a:p)}return[Dd(t,r+(t[i]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),n]};let Ts=class jd{constructor({strings:e,_$litType$:i},n){let o;this.parts=[];let r=0,s=0;const a=e.length-1,l=this.parts,[c,d]=vm(e,i);if(this.el=jd.createElement(c,n),ci.currentNode=this.el.content,i===2||i===3){const u=this.el.content.firstChild;u.replaceWith(...u.childNodes)}for(;(o=ci.nextNode())!==null&&l.length<a;){if(o.nodeType===1){if(o.hasAttributes())for(const u of o.getAttributeNames())if(u.endsWith(zd)){const h=d[s++],p=o.getAttribute(u).split(Mt),m=/([.?@])?(.*)/.exec(h);l.push({type:1,index:r,name:m[2],strings:p,ctor:m[1]==="."?$m:m[1]==="?"?_m:m[1]==="@"?xm:Pr}),o.removeAttribute(u)}else u.startsWith(Mt)&&(l.push({type:6,index:r}),o.removeAttribute(u));if(Md.test(o.tagName)){const u=o.textContent.split(Mt),h=u.length-1;if(h>0){o.textContent=er?er.emptyScript:"";for(let p=0;p<h;p++)o.append(u[p],qn()),ci.nextNode(),l.push({type:2,index:++r});o.append(u[h],qn())}}}else if(o.nodeType===8)if(o.data===Ld)l.push({type:2,index:r});else{let u=-1;for(;(u=o.data.indexOf(Mt,u+1))!==-1;)l.push({type:7,index:r}),u+=Mt.length-1}r++}}static createElement(e,i){const n=vi.createElement("template");return n.innerHTML=e,n}};function Ji(t,e,i=t,n){var o,r;if(e===wi)return e;let s=n!==void 0?(o=i._$Co)==null?void 0:o[n]:i._$Cl;const a=Vn(e)?void 0:e._$litDirective$;return s?.constructor!==a&&((r=s?._$AO)==null||r.call(s,!1),a===void 0?s=void 0:(s=new a(t),s._$AT(t,i,n)),n!==void 0?(i._$Co??(i._$Co=[]))[n]=s:i._$Cl=s),s!==void 0&&(e=Ji(t,s._$AS(t,e.values),s,n)),e}let wm=class{constructor(e,i){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=i}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:i},parts:n}=this._$AD,o=(e?.creationScope??vi).importNode(i,!0);ci.currentNode=o;let r=ci.nextNode(),s=0,a=0,l=n[0];for(;l!==void 0;){if(s===l.index){let c;l.type===2?c=new Aa(r,r.nextSibling,this,e):l.type===1?c=new l.ctor(r,l.name,l.strings,this,e):l.type===6&&(c=new Em(r,this,e)),this._$AV.push(c),l=n[++a]}s!==l?.index&&(r=ci.nextNode(),s++)}return ci.currentNode=vi,o}p(e){let i=0;for(const n of this._$AV)n!==void 0&&(n.strings!==void 0?(n._$AI(e,n,i),i+=n.strings.length-2):n._$AI(e[i])),i++}},Aa=class Rd{get _$AU(){var e;return((e=this._$AM)==null?void 0:e._$AU)??this._$Cv}constructor(e,i,n,o){this.type=2,this._$AH=ie,this._$AN=void 0,this._$AA=e,this._$AB=i,this._$AM=n,this.options=o,this._$Cv=o?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const i=this._$AM;return i!==void 0&&e?.nodeType===11&&(e=i.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,i=this){e=Ji(this,e,i),Vn(e)?e===ie||e==null||e===""?(this._$AH!==ie&&this._$AR(),this._$AH=ie):e!==this._$AH&&e!==wi&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):gm(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==ie&&Vn(this._$AH)?this._$AA.nextSibling.data=e:this.T(vi.createTextNode(e)),this._$AH=e}$(e){var i;const{values:n,_$litType$:o}=e,r=typeof o=="number"?this._$AC(e):(o.el===void 0&&(o.el=Ts.createElement(Dd(o.h,o.h[0]),this.options)),o);if(((i=this._$AH)==null?void 0:i._$AD)===r)this._$AH.p(n);else{const s=new wm(r,this),a=s.u(this.options);s.p(n),this.T(a),this._$AH=s}}_$AC(e){let i=Dl.get(e.strings);return i===void 0&&Dl.set(e.strings,i=new Ts(e)),i}k(e){Sa(this._$AH)||(this._$AH=[],this._$AR());const i=this._$AH;let n,o=0;for(const r of e)o===i.length?i.push(n=new Rd(this.O(qn()),this.O(qn()),this,this.options)):n=i[o],n._$AI(r),o++;o<i.length&&(this._$AR(n&&n._$AB.nextSibling,o),i.length=o)}_$AR(e=this._$AA.nextSibling,i){var n;for((n=this._$AP)==null?void 0:n.call(this,!1,!0,i);e!==this._$AB;){const o=Ol(e).nextSibling;Ol(e).remove(),e=o}}setConnected(e){var i;this._$AM===void 0&&(this._$Cv=e,(i=this._$AP)==null||i.call(this,e))}},Pr=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,i,n,o,r){this.type=1,this._$AH=ie,this._$AN=void 0,this.element=e,this.name=i,this._$AM=o,this.options=r,n.length>2||n[0]!==""||n[1]!==""?(this._$AH=Array(n.length-1).fill(new String),this.strings=n):this._$AH=ie}_$AI(e,i=this,n,o){const r=this.strings;let s=!1;if(r===void 0)e=Ji(this,e,i,0),s=!Vn(e)||e!==this._$AH&&e!==wi,s&&(this._$AH=e);else{const a=e;let l,c;for(e=r[0],l=0;l<r.length-1;l++)c=Ji(this,a[n+l],i,l),c===wi&&(c=this._$AH[l]),s||(s=!Vn(c)||c!==this._$AH[l]),c===ie?e=ie:e!==ie&&(e+=(c??"")+r[l+1]),this._$AH[l]=c}s&&!o&&this.j(e)}j(e){e===ie?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},$m=class extends Pr{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===ie?void 0:e}},_m=class extends Pr{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==ie)}},xm=class extends Pr{constructor(e,i,n,o,r){super(e,i,n,o,r),this.type=5}_$AI(e,i=this){if((e=Ji(this,e,i,0)??ie)===wi)return;const n=this._$AH,o=e===ie&&n!==ie||e.capture!==n.capture||e.once!==n.once||e.passive!==n.passive,r=e!==ie&&(n===ie||o);o&&this.element.removeEventListener(this.name,this,n),r&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){var i;typeof this._$AH=="function"?this._$AH.call(((i=this.options)==null?void 0:i.host)??this.element,e):this._$AH.handleEvent(e)}},Em=class{constructor(e,i,n){this.element=e,this.type=6,this._$AN=void 0,this._$AM=i,this.options=n}get _$AU(){return this._$AM._$AU}_$AI(e){Ji(this,e)}};const jl=Qo.litHtmlPolyfillSupport;jl?.(Ts,Aa),(Qo.litHtmlVersions??(Qo.litHtmlVersions=[])).push("3.3.2");const Os=(t,e,i)=>{const n=i?.renderBefore??e;let o=n._$litPart$;if(o===void 0){const r=i?.renderBefore??null;n._$litPart$=o=new Aa(e.insertBefore(qn(),r),r,void 0,i??{})}return o._$AI(t),o};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Gn=globalThis;let Z=class extends Li{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var t;const e=super.createRenderRoot();return(t=this.renderOptions).renderBefore??(t.renderBefore=e.firstChild),e}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Os(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return wi}};var Rl;Z._$litElement$=!0,Z.finalized=!0,(Rl=Gn.litElementHydrateSupport)==null||Rl.call(Gn,{LitElement:Z});const Bl=Gn.litElementPolyfillSupport;Bl?.({LitElement:Z});(Gn.litElementVersions??(Gn.litElementVersions=[])).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Sm={attribute:!0,type:String,converter:Ko,reflect:!1,hasChanged:Ea},Am=(t=Sm,e,i)=>{const{kind:n,metadata:o}=i;let r=globalThis.litPropertyMetadata.get(o);if(r===void 0&&globalThis.litPropertyMetadata.set(o,r=new Map),n==="setter"&&((t=Object.create(t)).wrapped=!0),r.set(i.name,t),n==="accessor"){const{name:s}=i;return{set(a){const l=e.get.call(this);e.set.call(this,a),this.requestUpdate(s,l,t,!0,a)},init(a){return a!==void 0&&this.C(s,void 0,t,a),a}}}if(n==="setter"){const{name:s}=i;return function(a){const l=this[s];e.call(this,a),this.requestUpdate(s,l,t,!0,a)}}throw Error("Unsupported decorator location: "+n)};function _(t){return(e,i)=>typeof i=="object"?Am(t,e,i):((n,o,r)=>{const s=o.hasOwnProperty(r);return o.constructor.createProperty(r,n),s?Object.getOwnPropertyDescriptor(o,r):void 0})(t,e,i)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function Ei(t){return _({...t,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Cm=t=>t.strings===void 0;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Bd={ATTRIBUTE:1,CHILD:2},Nd=t=>(...e)=>({_$litDirective$:t,values:e});let Fd=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,i,n){this._$Ct=e,this._$AM=i,this._$Ci=n}_$AS(e,i){return this.update(e,i)}update(e,i){return this.render(...i)}};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const zn=(t,e)=>{var i;const n=t._$AN;if(n===void 0)return!1;for(const o of n)(i=o._$AO)==null||i.call(o,e,!1),zn(o,e);return!0},tr=t=>{let e,i;do{if((e=t._$AM)===void 0)break;i=e._$AN,i.delete(t),t=e}while(i?.size===0)},Ud=t=>{for(let e;e=t._$AM;t=e){let i=e._$AN;if(i===void 0)e._$AN=i=new Set;else if(i.has(t))break;i.add(t),Om(e)}};function km(t){this._$AN!==void 0?(tr(this),this._$AM=t,Ud(this)):this._$AM=t}function Tm(t,e=!1,i=0){const n=this._$AH,o=this._$AN;if(o!==void 0&&o.size!==0)if(e)if(Array.isArray(n))for(let r=i;r<n.length;r++)zn(n[r],!1),tr(n[r]);else n!=null&&(zn(n,!1),tr(n));else zn(this,t)}const Om=t=>{t.type==Bd.CHILD&&(t._$AP??(t._$AP=Tm),t._$AQ??(t._$AQ=km))};let Im=class extends Fd{constructor(){super(...arguments),this._$AN=void 0}_$AT(e,i,n){super._$AT(e,i,n),Ud(this),this.isConnected=e._$AU}_$AO(e,i=!0){var n,o;e!==this.isConnected&&(this.isConnected=e,e?(n=this.reconnected)==null||n.call(this):(o=this.disconnected)==null||o.call(this)),i&&(zn(this,e),tr(this))}setValue(e){if(Cm(this._$Ct))this._$Ct._$AI(e,this);else{const i=[...this._$Ct._$AH];i[this._$Ci]=e,this._$Ct._$AI(i,this,0)}}disconnected(){}reconnected(){}};/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ki=()=>new Pm;let Pm=class{};const ls=new WeakMap,mt=Nd(class extends Im{render(t){return ie}update(t,[e]){var i;const n=e!==this.G;return n&&this.G!==void 0&&this.rt(void 0),(n||this.lt!==this.ct)&&(this.G=e,this.ht=(i=t.options)==null?void 0:i.host,this.rt(this.ct=t.element)),ie}rt(t){if(this.isConnected||(t=void 0),typeof this.G=="function"){const e=this.ht??globalThis;let i=ls.get(e);i===void 0&&(i=new WeakMap,ls.set(e,i)),i.get(this.G)!==void 0&&this.G.call(this.ht,void 0),i.set(this.G,t),t!==void 0&&this.G.call(this.ht,t)}else this.G.value=t}get lt(){var t,e;return typeof this.G=="function"?(t=ls.get(this.ht??globalThis))==null?void 0:t.get(this.G):(e=this.G)==null?void 0:e.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}});/**
* (c) Iconify
*
* For the full copyright and license information, please view the license.txt
* files at https://github.com/iconify/iconify
*
* Licensed under MIT.
*
* @license MIT
* @version 2.0.0
*/const Hd=Object.freeze({left:0,top:0,width:16,height:16}),ir=Object.freeze({rotate:0,vFlip:!1,hFlip:!1}),po=Object.freeze({...Hd,...ir}),Is=Object.freeze({...po,body:"",hidden:!1}),zm=Object.freeze({width:null,height:null}),qd=Object.freeze({...zm,...ir});function Lm(t,e=0){const i=t.replace(/^-?[0-9.]*/,"");function n(o){for(;o<0;)o+=4;return o%4}if(i===""){const o=parseInt(t);return isNaN(o)?0:n(o)}else if(i!==t){let o=0;switch(i){case"%":o=25;break;case"deg":o=90}if(o){let r=parseFloat(t.slice(0,t.length-i.length));return isNaN(r)?0:(r=r/o,r%1===0?n(r):0)}}return e}const Mm=/[\s,]+/;function Dm(t,e){e.split(Mm).forEach(i=>{switch(i.trim()){case"horizontal":t.hFlip=!0;break;case"vertical":t.vFlip=!0;break}})}const Vd={...qd,preserveAspectRatio:""};function Nl(t){const e={...Vd},i=(n,o)=>t.getAttribute(n)||o;return e.width=i("width",null),e.height=i("height",null),e.rotate=Lm(i("rotate","")),Dm(e,i("flip","")),e.preserveAspectRatio=i("preserveAspectRatio",i("preserveaspectratio","")),e}function jm(t,e){for(const i in Vd)if(t[i]!==e[i])return!0;return!1}const Ln=/^[a-z0-9]+(-[a-z0-9]+)*$/,fo=(t,e,i,n="")=>{const o=t.split(":");if(t.slice(0,1)==="@"){if(o.length<2||o.length>3)return null;n=o.shift().slice(1)}if(o.length>3||!o.length)return null;if(o.length>1){const a=o.pop(),l=o.pop(),c={provider:o.length>0?o[0]:n,prefix:l,name:a};return e&&!Uo(c)?null:c}const r=o[0],s=r.split("-");if(s.length>1){const a={provider:n,prefix:s.shift(),name:s.join("-")};return e&&!Uo(a)?null:a}if(i&&n===""){const a={provider:n,prefix:"",name:r};return e&&!Uo(a,i)?null:a}return null},Uo=(t,e)=>t?!!((t.provider===""||t.provider.match(Ln))&&(e&&t.prefix===""||t.prefix.match(Ln))&&t.name.match(Ln)):!1;function Rm(t,e){const i={};!t.hFlip!=!e.hFlip&&(i.hFlip=!0),!t.vFlip!=!e.vFlip&&(i.vFlip=!0);const n=((t.rotate||0)+(e.rotate||0))%4;return n&&(i.rotate=n),i}function Fl(t,e){const i=Rm(t,e);for(const n in Is)n in ir?n in t&&!(n in i)&&(i[n]=ir[n]):n in e?i[n]=e[n]:n in t&&(i[n]=t[n]);return i}function Bm(t,e){const i=t.icons,n=t.aliases||Object.create(null),o=Object.create(null);function r(s){if(i[s])return o[s]=[];if(!(s in o)){o[s]=null;const a=n[s]&&n[s].parent,l=a&&r(a);l&&(o[s]=[a].concat(l))}return o[s]}return Object.keys(i).concat(Object.keys(n)).forEach(r),o}function Nm(t,e,i){const n=t.icons,o=t.aliases||Object.create(null);let r={};function s(a){r=Fl(n[a]||o[a],r)}return s(e),i.forEach(s),Fl(t,r)}function Gd(t,e){const i=[];if(typeof t!="object"||typeof t.icons!="object")return i;t.not_found instanceof Array&&t.not_found.forEach(o=>{e(o,null),i.push(o)});const n=Bm(t);for(const o in n){const r=n[o];r&&(e(o,Nm(t,o,r)),i.push(o))}return i}const Fm={provider:"",aliases:{},not_found:{},...Hd};function cs(t,e){for(const i in e)if(i in t&&typeof t[i]!=typeof e[i])return!1;return!0}function Wd(t){if(typeof t!="object"||t===null)return null;const e=t;if(typeof e.prefix!="string"||!t.icons||typeof t.icons!="object"||!cs(t,Fm))return null;const i=e.icons;for(const o in i){const r=i[o];if(!o.match(Ln)||typeof r.body!="string"||!cs(r,Is))return null}const n=e.aliases||Object.create(null);for(const o in n){const r=n[o],s=r.parent;if(!o.match(Ln)||typeof s!="string"||!i[s]&&!n[s]||!cs(r,Is))return null}return e}const nr=Object.create(null);function Um(t,e){return{provider:t,prefix:e,icons:Object.create(null),missing:new Set}}function Ut(t,e){const i=nr[t]||(nr[t]=Object.create(null));return i[e]||(i[e]=Um(t,e))}function Ca(t,e){return Wd(e)?Gd(e,(i,n)=>{n?t.icons[i]=n:t.missing.add(i)}):[]}function Hm(t,e,i){try{if(typeof i.body=="string")return t.icons[e]={...i},!0}catch{}return!1}function qm(t,e){let i=[];return(typeof t=="string"?[t]:Object.keys(nr)).forEach(n=>{(typeof n=="string"&&typeof e=="string"?[e]:Object.keys(nr[n]||{})).forEach(o=>{const r=Ut(n,o);i=i.concat(Object.keys(r.icons).map(s=>(n!==""?"@"+n+":":"")+o+":"+s))})}),i}let Wn=!1;function Yd(t){return typeof t=="boolean"&&(Wn=t),Wn}function Yn(t){const e=typeof t=="string"?fo(t,!0,Wn):t;if(e){const i=Ut(e.provider,e.prefix),n=e.name;return i.icons[n]||(i.missing.has(n)?null:void 0)}}function Xd(t,e){const i=fo(t,!0,Wn);if(!i)return!1;const n=Ut(i.provider,i.prefix);return Hm(n,i.name,e)}function Ul(t,e){if(typeof t!="object")return!1;if(typeof e!="string"&&(e=t.provider||""),Wn&&!e&&!t.prefix){let o=!1;return Wd(t)&&(t.prefix="",Gd(t,(r,s)=>{s&&Xd(r,s)&&(o=!0)})),o}const i=t.prefix;if(!Uo({provider:e,prefix:i,name:"a"}))return!1;const n=Ut(e,i);return!!Ca(n,t)}function Hl(t){return!!Yn(t)}function Vm(t){const e=Yn(t);return e?{...po,...e}:null}function Gm(t){const e={loaded:[],missing:[],pending:[]},i=Object.create(null);t.sort((o,r)=>o.provider!==r.provider?o.provider.localeCompare(r.provider):o.prefix!==r.prefix?o.prefix.localeCompare(r.prefix):o.name.localeCompare(r.name));let n={provider:"",prefix:"",name:""};return t.forEach(o=>{if(n.name===o.name&&n.prefix===o.prefix&&n.provider===o.provider)return;n=o;const r=o.provider,s=o.prefix,a=o.name,l=i[r]||(i[r]=Object.create(null)),c=l[s]||(l[s]=Ut(r,s));let d;a in c.icons?d=e.loaded:s===""||c.missing.has(a)?d=e.missing:d=e.pending;const u={provider:r,prefix:s,name:a};d.push(u)}),e}function Zd(t,e){t.forEach(i=>{const n=i.loaderCallbacks;n&&(i.loaderCallbacks=n.filter(o=>o.id!==e))})}function Wm(t){t.pendingCallbacksFlag||(t.pendingCallbacksFlag=!0,setTimeout(()=>{t.pendingCallbacksFlag=!1;const e=t.loaderCallbacks?t.loaderCallbacks.slice(0):[];if(!e.length)return;let i=!1;const n=t.provider,o=t.prefix;e.forEach(r=>{const s=r.icons,a=s.pending.length;s.pending=s.pending.filter(l=>{if(l.prefix!==o)return!0;const c=l.name;if(t.icons[c])s.loaded.push({provider:n,prefix:o,name:c});else if(t.missing.has(c))s.missing.push({provider:n,prefix:o,name:c});else return i=!0,!0;return!1}),s.pending.length!==a&&(i||Zd([t],r.id),r.callback(s.loaded.slice(0),s.missing.slice(0),s.pending.slice(0),r.abort))})}))}let Ym=0;function Xm(t,e,i){const n=Ym++,o=Zd.bind(null,i,n);if(!e.pending.length)return o;const r={id:n,icons:e,callback:t,abort:o};return i.forEach(s=>{(s.loaderCallbacks||(s.loaderCallbacks=[])).push(r)}),o}const Ps=Object.create(null);function ql(t,e){Ps[t]=e}function zs(t){return Ps[t]||Ps[""]}function Zm(t,e=!0,i=!1){const n=[];return t.forEach(o=>{const r=typeof o=="string"?fo(o,e,i):o;r&&n.push(r)}),n}var Jm={resources:[],index:0,timeout:2e3,rotate:750,random:!1,dataAfterTimeout:!1};function Km(t,e,i,n){const o=t.resources.length,r=t.random?Math.floor(Math.random()*o):t.index;let s;if(t.random){let E=t.resources.slice(0);for(s=[];E.length>1;){const O=Math.floor(Math.random()*E.length);s.push(E[O]),E=E.slice(0,O).concat(E.slice(O+1))}s=s.concat(E)}else s=t.resources.slice(r).concat(t.resources.slice(0,r));const a=Date.now();let l="pending",c=0,d,u=null,h=[],p=[];typeof n=="function"&&p.push(n);function m(){u&&(clearTimeout(u),u=null)}function g(){l==="pending"&&(l="aborted"),m(),h.forEach(E=>{E.status==="pending"&&(E.status="aborted")}),h=[]}function f(E,O){O&&(p=[]),typeof E=="function"&&p.push(E)}function v(){return{startTime:a,payload:e,status:l,queriesSent:c,queriesPending:h.length,subscribe:f,abort:g}}function b(){l="failed",p.forEach(E=>{E(void 0,d)})}function y(){h.forEach(E=>{E.status==="pending"&&(E.status="aborted")}),h=[]}function $(E,O,D){const P=O!=="success";switch(h=h.filter(T=>T!==E),l){case"pending":break;case"failed":if(P||!t.dataAfterTimeout)return;break;default:return}if(O==="abort"){d=D,b();return}if(P){d=D,h.length||(s.length?A():b());return}if(m(),y(),!t.random){const T=t.resources.indexOf(E.resource);T!==-1&&T!==t.index&&(t.index=T)}l="completed",p.forEach(T=>{T(D)})}function A(){if(l!=="pending")return;m();const E=s.shift();if(E===void 0){if(h.length){u=setTimeout(()=>{m(),l==="pending"&&(y(),b())},t.timeout);return}b();return}const O={status:"pending",resource:E,callback:(D,P)=>{$(O,D,P)}};h.push(O),c++,u=setTimeout(A,t.rotate),i(E,e,O.callback)}return setTimeout(A),v}function Jd(t){const e={...Jm,...t};let i=[];function n(){i=i.filter(s=>s().status==="pending")}function o(s,a,l){const c=Km(e,s,a,(d,u)=>{n(),l&&l(d,u)});return i.push(c),c}function r(s){return i.find(a=>s(a))||null}return{query:o,find:r,setIndex:s=>{e.index=s},getIndex:()=>e.index,cleanup:n}}function ka(t){let e;if(typeof t.resources=="string")e=[t.resources];else if(e=t.resources,!(e instanceof Array)||!e.length)return null;return{resources:e,path:t.path||"/",maxURL:t.maxURL||500,rotate:t.rotate||750,timeout:t.timeout||5e3,random:t.random===!0,index:t.index||0,dataAfterTimeout:t.dataAfterTimeout!==!1}}const zr=Object.create(null),Mo=["https://api.simplesvg.com","https://api.unisvg.com"],Ls=[];for(;Mo.length>0;)Mo.length===1||Math.random()>.5?Ls.push(Mo.shift()):Ls.push(Mo.pop());zr[""]=ka({resources:["https://api.iconify.design"].concat(Ls)});function Vl(t,e){const i=ka(e);return i===null?!1:(zr[t]=i,!0)}function Lr(t){return zr[t]}function Qm(){return Object.keys(zr)}function Gl(){}const ds=Object.create(null);function eb(t){if(!ds[t]){const e=Lr(t);if(!e)return;const i=Jd(e),n={config:e,redundancy:i};ds[t]=n}return ds[t]}function Kd(t,e,i){let n,o;if(typeof t=="string"){const r=zs(t);if(!r)return i(void 0,424),Gl;o=r.send;const s=eb(t);s&&(n=s.redundancy)}else{const r=ka(t);if(r){n=Jd(r);const s=t.resources?t.resources[0]:"",a=zs(s);a&&(o=a.send)}}return!n||!o?(i(void 0,424),Gl):n.query(e,o,i)().abort}const Wl="iconify2",Xn="iconify",Qd=Xn+"-count",Yl=Xn+"-version",eu=36e5,tb=168,ib=50;function Ms(t,e){try{return t.getItem(e)}catch{}}function Ta(t,e,i){try{return t.setItem(e,i),!0}catch{}}function Xl(t,e){try{t.removeItem(e)}catch{}}function Ds(t,e){return Ta(t,Qd,e.toString())}function js(t){return parseInt(Ms(t,Qd))||0}const pi={local:!0,session:!0},tu={local:new Set,session:new Set};let Oa=!1;function nb(t){Oa=t}let Do=typeof window>"u"?{}:window;function iu(t){const e=t+"Storage";try{if(Do&&Do[e]&&typeof Do[e].length=="number")return Do[e]}catch{}pi[t]=!1}function nu(t,e){const i=iu(t);if(!i)return;const n=Ms(i,Yl);if(n!==Wl){if(n){const a=js(i);for(let l=0;l<a;l++)Xl(i,Xn+l.toString())}Ta(i,Yl,Wl),Ds(i,0);return}const o=Math.floor(Date.now()/eu)-tb,r=a=>{const l=Xn+a.toString(),c=Ms(i,l);if(typeof c=="string"){try{const d=JSON.parse(c);if(typeof d=="object"&&typeof d.cached=="number"&&d.cached>o&&typeof d.provider=="string"&&typeof d.data=="object"&&typeof d.data.prefix=="string"&&e(d,a))return!0}catch{}Xl(i,l)}};let s=js(i);for(let a=s-1;a>=0;a--)r(a)||(a===s-1?(s--,Ds(i,s)):tu[t].add(a))}function ou(){if(!Oa){nb(!0);for(const t in pi)nu(t,e=>{const i=e.data,n=e.provider,o=i.prefix,r=Ut(n,o);if(!Ca(r,i).length)return!1;const s=i.lastModified||-1;return r.lastModifiedCached=r.lastModifiedCached?Math.min(r.lastModifiedCached,s):s,!0})}}function ob(t,e){const i=t.lastModifiedCached;if(i&&i>=e)return i===e;if(t.lastModifiedCached=e,i)for(const n in pi)nu(n,o=>{const r=o.data;return o.provider!==t.provider||r.prefix!==t.prefix||r.lastModified===e});return!0}function rb(t,e){Oa||ou();function i(n){let o;if(!pi[n]||!(o=iu(n)))return;const r=tu[n];let s;if(r.size)r.delete(s=Array.from(r).shift());else if(s=js(o),s>=ib||!Ds(o,s+1))return;const a={cached:Math.floor(Date.now()/eu),provider:t.provider,data:e};return Ta(o,Xn+s.toString(),JSON.stringify(a))}e.lastModified&&!ob(t,e.lastModified)||Object.keys(e.icons).length&&(e.not_found&&(e=Object.assign({},e),delete e.not_found),i("local")||i("session"))}function Zl(){}function sb(t){t.iconsLoaderFlag||(t.iconsLoaderFlag=!0,setTimeout(()=>{t.iconsLoaderFlag=!1,Wm(t)}))}function ab(t,e){t.iconsToLoad?t.iconsToLoad=t.iconsToLoad.concat(e).sort():t.iconsToLoad=e,t.iconsQueueFlag||(t.iconsQueueFlag=!0,setTimeout(()=>{t.iconsQueueFlag=!1;const{provider:i,prefix:n}=t,o=t.iconsToLoad;delete t.iconsToLoad;let r;!o||!(r=zs(i))||r.prepare(i,n,o).forEach(s=>{Kd(i,s,a=>{if(typeof a!="object")s.icons.forEach(l=>{t.missing.add(l)});else try{const l=Ca(t,a);if(!l.length)return;const c=t.pendingIcons;c&&l.forEach(d=>{c.delete(d)}),rb(t,a)}catch(l){console.error(l)}sb(t)})})}))}const Ia=(t,e)=>{const i=Zm(t,!0,Yd()),n=Gm(i);if(!n.pending.length){let l=!0;return e&&setTimeout(()=>{l&&e(n.loaded,n.missing,n.pending,Zl)}),()=>{l=!1}}const o=Object.create(null),r=[];let s,a;return n.pending.forEach(l=>{const{provider:c,prefix:d}=l;if(d===a&&c===s)return;s=c,a=d,r.push(Ut(c,d));const u=o[c]||(o[c]=Object.create(null));u[d]||(u[d]=[])}),n.pending.forEach(l=>{const{provider:c,prefix:d,name:u}=l,h=Ut(c,d),p=h.pendingIcons||(h.pendingIcons=new Set);p.has(u)||(p.add(u),o[c][d].push(u))}),r.forEach(l=>{const{provider:c,prefix:d}=l;o[c][d].length&&ab(l,o[c][d])}),e?Xm(e,n,r):Zl},lb=t=>new Promise((e,i)=>{const n=typeof t=="string"?fo(t,!0):t;if(!n){i(t);return}Ia([n||t],o=>{if(o.length&&n){const r=Yn(n);if(r){e({...po,...r});return}}i(t)})});function cb(t){try{const e=typeof t=="string"?JSON.parse(t):t;if(typeof e.body=="string")return{...e}}catch{}}function db(t,e){const i=typeof t=="string"?fo(t,!0,!0):null;if(!i){const r=cb(t);return{value:t,data:r}}const n=Yn(i);if(n!==void 0||!i.prefix)return{value:t,name:i,data:n};const o=Ia([i],()=>e(t,i,Yn(i)));return{value:t,name:i,loading:o}}function us(t){return t.hasAttribute("inline")}let ru=!1;try{ru=navigator.vendor.indexOf("Apple")===0}catch{}function ub(t,e){switch(e){case"svg":case"bg":case"mask":return e}return e!=="style"&&(ru||t.indexOf("<a")===-1)?"svg":t.indexOf("currentColor")===-1?"bg":"mask"}const hb=/(-?[0-9.]*[0-9]+[0-9.]*)/g,pb=/^-?[0-9.]*[0-9]+[0-9.]*$/g;function Rs(t,e,i){if(e===1)return t;if(i=i||100,typeof t=="number")return Math.ceil(t*e*i)/i;if(typeof t!="string")return t;const n=t.split(hb);if(n===null||!n.length)return t;const o=[];let r=n.shift(),s=pb.test(r);for(;;){if(s){const a=parseFloat(r);isNaN(a)?o.push(r):o.push(Math.ceil(a*e*i)/i)}else o.push(r);if(r=n.shift(),r===void 0)return o.join("");s=!s}}function fb(t,e="defs"){let i="";const n=t.indexOf("<"+e);for(;n>=0;){const o=t.indexOf(">",n),r=t.indexOf("</"+e);if(o===-1||r===-1)break;const s=t.indexOf(">",r);if(s===-1)break;i+=t.slice(o+1,r).trim(),t=t.slice(0,n).trim()+t.slice(s+1)}return{defs:i,content:t}}function mb(t,e){return t?"<defs>"+t+"</defs>"+e:e}function bb(t,e,i){const n=fb(t);return mb(n.defs,e+n.content+i)}const gb=t=>t==="unset"||t==="undefined"||t==="none";function su(t,e){const i={...po,...t},n={...qd,...e},o={left:i.left,top:i.top,width:i.width,height:i.height};let r=i.body;[i,n].forEach(g=>{const f=[],v=g.hFlip,b=g.vFlip;let y=g.rotate;v?b?y+=2:(f.push("translate("+(o.width+o.left).toString()+" "+(0-o.top).toString()+")"),f.push("scale(-1 1)"),o.top=o.left=0):b&&(f.push("translate("+(0-o.left).toString()+" "+(o.height+o.top).toString()+")"),f.push("scale(1 -1)"),o.top=o.left=0);let $;switch(y<0&&(y-=Math.floor(y/4)*4),y=y%4,y){case 1:$=o.height/2+o.top,f.unshift("rotate(90 "+$.toString()+" "+$.toString()+")");break;case 2:f.unshift("rotate(180 "+(o.width/2+o.left).toString()+" "+(o.height/2+o.top).toString()+")");break;case 3:$=o.width/2+o.left,f.unshift("rotate(-90 "+$.toString()+" "+$.toString()+")");break}y%2===1&&(o.left!==o.top&&($=o.left,o.left=o.top,o.top=$),o.width!==o.height&&($=o.width,o.width=o.height,o.height=$)),f.length&&(r=bb(r,'<g transform="'+f.join(" ")+'">',"</g>"))});const s=n.width,a=n.height,l=o.width,c=o.height;let d,u;s===null?(u=a===null?"1em":a==="auto"?c:a,d=Rs(u,l/c)):(d=s==="auto"?l:s,u=a===null?Rs(d,c/l):a==="auto"?c:a);const h={},p=(g,f)=>{gb(f)||(h[g]=f.toString())};p("width",d),p("height",u);const m=[o.left,o.top,l,c];return h.viewBox=m.join(" "),{attributes:h,viewBox:m,body:r}}function Pa(t,e){let i=t.indexOf("xlink:")===-1?"":' xmlns:xlink="http://www.w3.org/1999/xlink"';for(const n in e)i+=" "+n+'="'+e[n]+'"';return'<svg xmlns="http://www.w3.org/2000/svg"'+i+">"+t+"</svg>"}function yb(t){return t.replace(/"/g,"'").replace(/%/g,"%25").replace(/#/g,"%23").replace(/</g,"%3C").replace(/>/g,"%3E").replace(/\s+/g," ")}function vb(t){return"data:image/svg+xml,"+yb(t)}function au(t){return'url("'+vb(t)+'")'}const wb=()=>{let t;try{if(t=fetch,typeof t=="function")return t}catch{}};let or=wb();function $b(t){or=t}function _b(){return or}function xb(t,e){const i=Lr(t);if(!i)return 0;let n;if(!i.maxURL)n=0;else{let o=0;i.resources.forEach(s=>{o=Math.max(o,s.length)});const r=e+".json?icons=";n=i.maxURL-o-i.path.length-r.length}return n}function Eb(t){return t===404}const Sb=(t,e,i)=>{const n=[],o=xb(t,e),r="icons";let s={type:r,provider:t,prefix:e,icons:[]},a=0;return i.forEach((l,c)=>{a+=l.length+1,a>=o&&c>0&&(n.push(s),s={type:r,provider:t,prefix:e,icons:[]},a=l.length),s.icons.push(l)}),n.push(s),n};function Ab(t){if(typeof t=="string"){const e=Lr(t);if(e)return e.path}return"/"}const Cb=(t,e,i)=>{if(!or){i("abort",424);return}let n=Ab(e.provider);switch(e.type){case"icons":{const r=e.prefix,s=e.icons.join(","),a=new URLSearchParams({icons:s});n+=r+".json?"+a.toString();break}case"custom":{const r=e.uri;n+=r.slice(0,1)==="/"?r.slice(1):r;break}default:i("abort",400);return}let o=503;or(t+n).then(r=>{const s=r.status;if(s!==200){setTimeout(()=>{i(Eb(s)?"abort":"next",s)});return}return o=501,r.json()}).then(r=>{if(typeof r!="object"||r===null){setTimeout(()=>{r===404?i("abort",r):i("next",o)});return}setTimeout(()=>{i("success",r)})}).catch(()=>{i("next",o)})},kb={prepare:Sb,send:Cb};function Jl(t,e){switch(t){case"local":case"session":pi[t]=e;break;case"all":for(const i in pi)pi[i]=e;break}}const hs="data-style";let lu="";function Tb(t){lu=t}function Kl(t,e){let i=Array.from(t.childNodes).find(n=>n.hasAttribute&&n.hasAttribute(hs));i||(i=document.createElement("style"),i.setAttribute(hs,hs),t.appendChild(i)),i.textContent=":host{display:inline-block;vertical-align:"+(e?"-0.125em":"0")+"}span,svg{display:block}"+lu}function cu(){ql("",kb),Yd(!0);let t;try{t=window}catch{}if(t){if(ou(),t.IconifyPreload!==void 0){const e=t.IconifyPreload,i="Invalid IconifyPreload syntax.";typeof e=="object"&&e!==null&&(e instanceof Array?e:[e]).forEach(n=>{try{(typeof n!="object"||n===null||n instanceof Array||typeof n.icons!="object"||typeof n.prefix!="string"||!Ul(n))&&console.error(i)}catch{console.error(i)}})}if(t.IconifyProviders!==void 0){const e=t.IconifyProviders;if(typeof e=="object"&&e!==null)for(const i in e){const n="IconifyProviders["+i+"] is invalid.";try{const o=e[i];if(typeof o!="object"||!o||o.resources===void 0)continue;Vl(i,o)||console.error(n)}catch{console.error(n)}}}}return{enableCache:e=>Jl(e,!0),disableCache:e=>Jl(e,!1),iconLoaded:Hl,iconExists:Hl,getIcon:Vm,listIcons:qm,addIcon:Xd,addCollection:Ul,calculateSize:Rs,buildIcon:su,iconToHTML:Pa,svgToURL:au,loadIcons:Ia,loadIcon:lb,addAPIProvider:Vl,appendCustomStyle:Tb,_api:{getAPIConfig:Lr,setAPIModule:ql,sendAPIQuery:Kd,setFetch:$b,getFetch:_b,listAPIProviders:Qm}}}const Bs={"background-color":"currentColor"},du={"background-color":"transparent"},Ql={image:"var(--svg)",repeat:"no-repeat",size:"100% 100%"},ec={"-webkit-mask":Bs,mask:Bs,background:du};for(const t in ec){const e=ec[t];for(const i in Ql)e[t+"-"+i]=Ql[i]}function tc(t){return t?t+(t.match(/^[-0-9.]+$/)?"px":""):"inherit"}function Ob(t,e,i){const n=document.createElement("span");let o=t.body;o.indexOf("<a")!==-1&&(o+="<!-- "+Date.now()+" -->");const r=t.attributes,s=Pa(o,{...r,width:e.width+"",height:e.height+""}),a=au(s),l=n.style,c={"--svg":a,width:tc(r.width),height:tc(r.height),...i?Bs:du};for(const d in c)l.setProperty(d,c[d]);return n}let Mn;function Ib(){try{Mn=window.trustedTypes.createPolicy("iconify",{createHTML:t=>t})}catch{Mn=null}}function Pb(t){return Mn===void 0&&Ib(),Mn?Mn.createHTML(t):t}function zb(t){const e=document.createElement("span"),i=t.attributes;let n="";i.width||(n="width: inherit;"),i.height||(n+="height: inherit;"),n&&(i.style=n);const o=Pa(t.body,i);return e.innerHTML=Pb(o),e.firstChild}function Ns(t){return Array.from(t.childNodes).find(e=>{const i=e.tagName&&e.tagName.toUpperCase();return i==="SPAN"||i==="SVG"})}function ic(t,e){const i=e.icon.data,n=e.customisations,o=su(i,n);n.preserveAspectRatio&&(o.attributes.preserveAspectRatio=n.preserveAspectRatio);const r=e.renderedMode;let s;switch(r){case"svg":s=zb(o);break;default:s=Ob(o,{...po,...i},r==="mask")}const a=Ns(t);a?s.tagName==="SPAN"&&a.tagName===s.tagName?a.setAttribute("style",s.getAttribute("style")):t.replaceChild(s,a):t.appendChild(s)}function nc(t,e,i){const n=i&&(i.rendered?i:i.lastRender);return{rendered:!1,inline:e,icon:t,lastRender:n}}function Lb(t="iconify-icon"){let e,i;try{e=window.customElements,i=window.HTMLElement}catch{return}if(!e||!i)return;const n=e.get(t);if(n)return n;const o=["icon","mode","inline","observe","width","height","rotate","flip"],r=class extends i{constructor(){super(),ni(this,"_shadowRoot"),ni(this,"_initialised",!1),ni(this,"_state"),ni(this,"_checkQueued",!1),ni(this,"_connected",!1),ni(this,"_observer",null),ni(this,"_visible",!0);const a=this._shadowRoot=this.attachShadow({mode:"open"}),l=us(this);Kl(a,l),this._state=nc({value:""},l),this._queueCheck()}connectedCallback(){this._connected=!0,this.startObserver()}disconnectedCallback(){this._connected=!1,this.stopObserver()}static get observedAttributes(){return o.slice(0)}attributeChangedCallback(a){switch(a){case"inline":{const l=us(this),c=this._state;l!==c.inline&&(c.inline=l,Kl(this._shadowRoot,l));break}case"observer":{this.observer?this.startObserver():this.stopObserver();break}default:this._queueCheck()}}get icon(){const a=this.getAttribute("icon");if(a&&a.slice(0,1)==="{")try{return JSON.parse(a)}catch{}return a}set icon(a){typeof a=="object"&&(a=JSON.stringify(a)),this.setAttribute("icon",a)}get inline(){return us(this)}set inline(a){a?this.setAttribute("inline","true"):this.removeAttribute("inline")}get observer(){return this.hasAttribute("observer")}set observer(a){a?this.setAttribute("observer","true"):this.removeAttribute("observer")}restartAnimation(){const a=this._state;if(a.rendered){const l=this._shadowRoot;if(a.renderedMode==="svg")try{l.lastChild.setCurrentTime(0);return}catch{}ic(l,a)}}get status(){const a=this._state;return a.rendered?"rendered":a.icon.data===null?"failed":"loading"}_queueCheck(){this._checkQueued||(this._checkQueued=!0,setTimeout(()=>{this._check()}))}_check(){if(!this._checkQueued)return;this._checkQueued=!1;const a=this._state,l=this.getAttribute("icon");if(l!==a.icon.value){this._iconChanged(l);return}if(!a.rendered||!this._visible)return;const c=this.getAttribute("mode"),d=Nl(this);(a.attrMode!==c||jm(a.customisations,d)||!Ns(this._shadowRoot))&&this._renderIcon(a.icon,d,c)}_iconChanged(a){const l=db(a,(c,d,u)=>{const h=this._state;if(h.rendered||this.getAttribute("icon")!==c)return;const p={value:c,name:d,data:u};p.data?this._gotIconData(p):h.icon=p});l.data?this._gotIconData(l):this._state=nc(l,this._state.inline,this._state)}_forceRender(){if(!this._visible){const a=Ns(this._shadowRoot);a&&this._shadowRoot.removeChild(a);return}this._queueCheck()}_gotIconData(a){this._checkQueued=!1,this._renderIcon(a,Nl(this),this.getAttribute("mode"))}_renderIcon(a,l,c){const d=ub(a.data.body,c),u=this._state.inline;ic(this._shadowRoot,this._state={rendered:!0,icon:a,inline:u,customisations:l,attrMode:c,renderedMode:d})}startObserver(){if(!this._observer)try{this._observer=new IntersectionObserver(a=>{const l=a.some(c=>c.isIntersecting);l!==this._visible&&(this._visible=l,this._forceRender())}),this._observer.observe(this)}catch{if(this._observer){try{this._observer.disconnect()}catch{}this._observer=null}}}stopObserver(){this._observer&&(this._observer.disconnect(),this._observer=null,this._visible=!0,this._connected&&this._forceRender())}};o.forEach(a=>{a in r.prototype||Object.defineProperty(r.prototype,a,{get:function(){return this.getAttribute(a)},set:function(l){l!==null?this.setAttribute(a,l):this.removeAttribute(a)}})});const s=cu();for(const a in s)r[a]=r.prototype[a]=s[a];return e.define(t,r),r}const Mb=Lb()||cu(),{enableCache:T_,disableCache:O_,iconLoaded:I_,iconExists:P_,getIcon:z_,listIcons:L_,addIcon:M_,addCollection:Db,calculateSize:D_,buildIcon:j_,iconToHTML:R_,svgToURL:B_,loadIcons:jb,loadIcon:N_,addAPIProvider:F_,_api:U_}=Mb,Rb=Q`
  ::-webkit-scrollbar {
    width: 0.4rem;
    height: 0.4rem;
    overflow: hidden;
  }

  ::-webkit-scrollbar-thumb {
    border-radius: 0.25rem;
    background-color: var(
      --bim-scrollbar--c,
      color-mix(in lab, var(--bim-ui_main-base), white 15%)
    );
  }

  ::-webkit-scrollbar-track {
    background-color: var(--bim-scrollbar--bgc, var(--bim-ui_bg-base));
  }
`,Bb=Q`
  :root {
    /* Grayscale Colors */
    --bim-ui_gray-0: hsl(210 10% 5%);
    --bim-ui_gray-1: hsl(210 10% 10%);
    --bim-ui_gray-2: hsl(210 10% 20%);
    --bim-ui_gray-3: hsl(210 10% 30%);
    --bim-ui_gray-4: hsl(210 10% 40%);
    --bim-ui_gray-5: hsl(210 10% 50%);
    --bim-ui_gray-6: hsl(210 10% 60%);
    --bim-ui_gray-7: hsl(210 10% 70%);
    --bim-ui_gray-8: hsl(210 10% 80%);
    --bim-ui_gray-9: hsl(210 10% 90%);
    --bim-ui_gray-10: hsl(210 10% 95%);

    /* Brand Colors */
    --bim-ui_main-base: #6528d7;
    --bim-ui_accent-base: #bcf124;

    /* Brand Colors Contrasts */
    --bim-ui_main-contrast: var(--bim-ui_gray-10);
    --bim-ui_accent-contrast: var(--bim-ui_gray-0);

    /* Sizes */
    --bim-ui_size-4xs: 0.375rem;
    --bim-ui_size-3xs: 0.5rem;
    --bim-ui_size-2xs: 0.625rem;
    --bim-ui_size-xs: 0.75rem;
    --bim-ui_size-sm: 0.875rem;
    --bim-ui_size-base: 1rem;
    --bim-ui_size-lg: 1.125rem;
    --bim-ui_size-xl: 1.25rem;
    --bim-ui_size-2xl: 1.375rem;
    --bim-ui_size-3xl: 1.5rem;
    --bim-ui_size-4xl: 1.625rem;
    --bim-ui_size-5xl: 1.75rem;
    --bim-ui_size-6xl: 1.875rem;
    --bim-ui_size-7xl: 2rem;
    --bim-ui_size-8xl: 2.125rem;
    --bim-ui_size-9xl: 2.25rem;
  }

  /* Background Colors */
  @media (prefers-color-scheme: dark) {
    :root {
      --bim-ui_bg-base: var(--bim-ui_gray-0);
      --bim-ui_bg-contrast-10: var(--bim-ui_gray-1);
      --bim-ui_bg-contrast-20: var(--bim-ui_gray-2);
      --bim-ui_bg-contrast-30: var(--bim-ui_gray-3);
      --bim-ui_bg-contrast-40: var(--bim-ui_gray-4);
      --bim-ui_bg-contrast-60: var(--bim-ui_gray-6);
      --bim-ui_bg-contrast-80: var(--bim-ui_gray-8);
      --bim-ui_bg-contrast-100: var(--bim-ui_gray-10);
    }
  }

  @media (prefers-color-scheme: light) {
    :root {
      --bim-ui_bg-base: var(--bim-ui_gray-10);
      --bim-ui_bg-contrast-10: var(--bim-ui_gray-9);
      --bim-ui_bg-contrast-20: var(--bim-ui_gray-8);
      --bim-ui_bg-contrast-30: var(--bim-ui_gray-7);
      --bim-ui_bg-contrast-40: var(--bim-ui_gray-6);
      --bim-ui_bg-contrast-60: var(--bim-ui_gray-4);
      --bim-ui_bg-contrast-80: var(--bim-ui_gray-2);
      --bim-ui_bg-contrast-100: var(--bim-ui_gray-0);
      --bim-ui_accent-base: #6528d7;
    }
  }

  .theme-transition-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    filter: drop-shadow(0 0 10px var(--bim-ui_bg-base));
    z-index: 9999;
  }

  .theme-transition-overlay > div {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--bim-ui_bg-base);
  }

  html.bim-ui-dark {
    --bim-ui_bg-base: var(--bim-ui_gray-0);
    --bim-ui_bg-contrast-10: var(--bim-ui_gray-1);
    --bim-ui_bg-contrast-20: var(--bim-ui_gray-2);
    --bim-ui_bg-contrast-30: var(--bim-ui_gray-3);
    --bim-ui_bg-contrast-40: var(--bim-ui_gray-4);
    --bim-ui_bg-contrast-60: var(--bim-ui_gray-6);
    --bim-ui_bg-contrast-80: var(--bim-ui_gray-8);
    --bim-ui_bg-contrast-100: var(--bim-ui_gray-10);
  }

  html.bim-ui-light {
    --bim-ui_bg-base: var(--bim-ui_gray-10);
    --bim-ui_bg-contrast-10: var(--bim-ui_gray-9);
    --bim-ui_bg-contrast-20: var(--bim-ui_gray-8);
    --bim-ui_bg-contrast-30: var(--bim-ui_gray-7);
    --bim-ui_bg-contrast-40: var(--bim-ui_gray-6);
    --bim-ui_bg-contrast-60: var(--bim-ui_gray-4);
    --bim-ui_bg-contrast-80: var(--bim-ui_gray-2);
    --bim-ui_bg-contrast-100: var(--bim-ui_gray-0);
    --bim-ui_accent-base: #6528d7;
  }

  @keyframes toggleOverlay {
    0%,
    99% {
      display: block;
    }

    100% {
      display: none;
    }
  }

  @keyframes toggleThemeAnimation {
    0% {
      clip-path: circle(0% at center top);
    }
    45%,
    55% {
      clip-path: circle(150% at center center);
    }
    100% {
      clip-path: circle(0% at center bottom);
    }
  }

  [data-context-dialog]::backdrop {
    background-color: transparent;
  }
`,Wt={scrollbar:Rb,globalStyles:Bb},uu=class G{static set config(e){this._config={...G._config,...e}}static get config(){return G._config}static addGlobalStyles(){let e=document.querySelector("style[id='bim-ui']");if(e)return;e=document.createElement("style"),e.id="bim-ui",e.textContent=Wt.globalStyles.cssText;const i=document.head.firstChild;i?document.head.insertBefore(e,i):document.head.append(e)}static preloadIcons(e,i=!1){jb(e,(n,o,r)=>{i&&(console.log("Icons loaded:",n),o.length&&console.warn("Icons missing:",o),r.length&&console.info("Icons pending:",r))})}static addIconsCollection(e,i){Db({prefix:i?.prefix??"bim",icons:e,width:24,height:24})}static defineCustomElement(e,i){customElements.get(e)||customElements.define(e,i)}static registerComponents(){G.init()}static init(e="",i=!0){G.addGlobalStyles(),G.defineCustomElement("bim-button",Vb),G.defineCustomElement("bim-checkbox",pn),G.defineCustomElement("bim-color-input",Yt),G.defineCustomElement("bim-context-menu",Ho),G.defineCustomElement("bim-dropdown",rt),G.defineCustomElement("bim-grid",La),G.defineCustomElement("bim-icon",Qb),G.defineCustomElement("bim-input",bo),G.defineCustomElement("bim-label",fn),G.defineCustomElement("bim-number-input",Ne),G.defineCustomElement("bim-option",ue),G.defineCustomElement("bim-panel",Ai),G.defineCustomElement("bim-panel-section",mn),G.defineCustomElement("bim-selector",bn),G.defineCustomElement("bim-table",Fe),G.defineCustomElement("bim-tabs",Tt),G.defineCustomElement("bim-tab",Ie),G.defineCustomElement("bim-table-cell",Au),G.defineCustomElement("bim-table-children",hg),G.defineCustomElement("bim-table-group",Ou),G.defineCustomElement("bim-table-row",Ci),G.defineCustomElement("bim-text-input",Ze),G.defineCustomElement("bim-toolbar",Fr),G.defineCustomElement("bim-toolbar-group",Br),G.defineCustomElement("bim-toolbar-section",vn),G.defineCustomElement("bim-viewport",Fu),G.defineCustomElement("bim-tooltip",Lg),i&&this.animateOnLoad(e)}static newRandomId(){const e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";let i="";for(let n=0;n<10;n++){const o=Math.floor(Math.random()*e.length);i+=e.charAt(o)}return i}static animateOnLoad(e=""){const i=`
      bim-input,
      bim-button,
      bim-checkbox,
      bim-selector,
      bim-label,
      bim-table-row,
      bim-panel-section,
      bim-table-children .branch-vertical,
      .switchers
    `,n=[];function o(r,s=document,a=new Set){const l=[];return Array.from(s.querySelectorAll(r)).forEach(c=>{a.has(c)||(a.add(c),l.push(c))}),Array.from(s.querySelectorAll("*")).filter(c=>c.shadowRoot).forEach(c=>{a.has(c)||(a.add(c),l.push(...o(r,c.shadowRoot,a)))}),l}requestAnimationFrame(()=>{o(e||i).forEach(s=>{const a=s;let l="auto";l=window.getComputedStyle(a).getPropertyValue("transition"),a.style.setProperty("opacity","0"),a.style.setProperty("transition","none"),requestAnimationFrame(()=>{a.style.setProperty("transition",l)}),n.push(a)});const r=()=>{n.forEach(s=>{const a=s,l=(a.getBoundingClientRect().x+a.getBoundingClientRect().y)/(window.innerWidth+window.innerHeight),c=window.getComputedStyle(a).getPropertyValue("transform"),d=400,u=200+l*1e3;a.animate([{transform:"translateY(-20px)",opacity:"0"},{transform:"translateY(0)",opacity:"1"}],{duration:d,easing:"ease-in-out",delay:u}),setTimeout(()=>{a.style.removeProperty("opacity"),c!=="none"?a.style.setProperty("transform",c):a.style.removeProperty("transform")},u+d)})};document.readyState==="complete"?r():window.addEventListener("load",r)})}static toggleTheme(e=!0){const i=document.querySelector("html");if(!i)return;const n=()=>{i.classList.contains("bim-ui-dark")?i.classList.replace("bim-ui-dark","bim-ui-light"):i.classList.contains("bim-ui-light")?i.classList.replace("bim-ui-light","bim-ui-dark"):i.classList.add("bim-ui-light")};if(e){const o=document.createElement("div");o.classList.add("theme-transition-overlay");const r=document.createElement("div");o.appendChild(r),r.style.setProperty("transition",`background-color ${1e3/3200}s`),document.body.appendChild(o),o.style.setProperty("animation",`toggleOverlay ${1e3/1e3}s ease-in forwards`),r.style.setProperty("animation",`toggleThemeAnimation ${1e3/1e3}s ease forwards`),setTimeout(()=>{n()},1e3/4),setTimeout(()=>{document.body.querySelectorAll(".theme-transition-overlay").forEach(s=>{document.body.removeChild(s)})},1e3)}else n()}};uu._config={sectionLabelOnVerticalToolbar:!1};let Mr=uu,Qi=class extends Z{constructor(){super(...arguments),this._lazyLoadObserver=null,this._visibleElements=[],this.ELEMENTS_BEFORE_OBSERVER=20,this.useObserver=!1,this.elements=new Set,this.observe=e=>{if(!this.useObserver)return;for(const n of e)this.elements.add(n);const i=e.slice(this.ELEMENTS_BEFORE_OBSERVER);for(const n of i)n.remove();this.observeLastElement()}}set visibleElements(e){this._visibleElements=this.useObserver?e:[],this.requestUpdate()}get visibleElements(){return this._visibleElements}getLazyObserver(){if(!this.useObserver)return null;if(this._lazyLoadObserver)return this._lazyLoadObserver;const e=new IntersectionObserver(i=>{const n=i[0];if(!n.isIntersecting)return;const o=n.target;e.unobserve(o);const r=this.ELEMENTS_BEFORE_OBSERVER+this.visibleElements.length,s=[...this.elements][r];s&&(this.visibleElements=[...this.visibleElements,s],e.observe(s))},{threshold:.5});return e}observeLastElement(){const e=this.getLazyObserver();if(!e)return;const i=this.ELEMENTS_BEFORE_OBSERVER+this.visibleElements.length-1,n=[...this.elements][i];n&&e.observe(n)}resetVisibleElements(){const e=this.getLazyObserver();if(e){for(const i of this.elements)e.unobserve(i);this.visibleElements=[],this.observeLastElement()}}static create(e,i){const n=document.createDocumentFragment();if(e.length===0)return Os(e(),n),n.firstElementChild;if(!i)throw new Error("UIComponent: Initial state is required for statefull components.");let o=i;const r=e,s=l=>(o={...o,...l},Os(r(o,s),n),o);s(i);const a=()=>o;return[n.firstElementChild,s,a]}};const rr=(t,e={},i=!0)=>{let n={};for(const o of t.children){const r=o,s=r.getAttribute("name")||r.getAttribute("label"),a=s?e[s]:void 0;if(s){if("value"in r&&typeof r.value<"u"&&r.value!==null){const l=r.value;if(typeof l=="object"&&!Array.isArray(l)&&Object.keys(l).length===0)continue;n[s]=a?a(r.value):r.value}else if(i){const l=rr(r,e);if(Object.keys(l).length===0)continue;n[s]=a?a(l):l}}else i&&(n={...n,...rr(r,e)})}return n},Dr=t=>t==="true"||t==="false"?t==="true":t&&!isNaN(Number(t))&&t.trim()!==""?Number(t):t,Nb=[">=","<=","=",">","<","?","/","#"];function oc(t){const e=Nb.find(s=>t.split(s).length===2),i=t.split(e).map(s=>s.trim()),[n,o]=i,r=o.startsWith("'")&&o.endsWith("'")?o.replace(/'/g,""):Dr(o);return{key:n,condition:e,value:r}}const Fs=t=>{try{const e=[],i=t.split(/&(?![^()]*\))/).map(n=>n.trim());for(const n of i){const o=!n.startsWith("(")&&!n.endsWith(")"),r=n.startsWith("(")&&n.endsWith(")");if(o){const s=oc(n);e.push(s)}if(r){const s={operator:"&",queries:n.replace(/^(\()|(\))$/g,"").split("&").map(a=>a.trim()).map((a,l)=>{const c=oc(a);return l>0&&(c.operator="&"),c})};e.push(s)}}return e}catch{return null}},rc=(t,e,i)=>{let n=!1;switch(e){case"=":n=t===i;break;case"?":n=String(t).includes(String(i));break;case"<":(typeof t=="number"||typeof i=="number")&&(n=t<i);break;case"<=":(typeof t=="number"||typeof i=="number")&&(n=t<=i);break;case">":(typeof t=="number"||typeof i=="number")&&(n=t>i);break;case">=":(typeof t=="number"||typeof i=="number")&&(n=t>=i);break;case"/":n=String(t).startsWith(String(i));break}return n};var Fb=Object.defineProperty,Ub=Object.getOwnPropertyDescriptor,hu=(t,e,i,n)=>{for(var o=Ub(e,i),r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&Fb(e,i,o),o},$e;const za=($e=class extends Z{constructor(){super(...arguments),this._previousContainer=null,this._visible=!1}get placement(){return this._placement}set placement(t){this._placement=t,this.updatePosition()}static removeMenus(){for(const t of[...$e.dialog.children])t instanceof $e&&(t.remove(),t.visible=!1);setTimeout(()=>{$e.dialog.close(),$e.dialog.remove()},310)}get visible(){return this._visible}set visible(t){this._visible=t,t?($e.dialog.parentElement||document.body.append($e.dialog),this._previousContainer=this.parentElement,$e.dialog.style.top=`${window.scrollY||document.documentElement.scrollTop}px`,this.style.setProperty("display","flex"),$e.dialog.append(this),$e.dialog.showModal(),this.updatePosition(),this.dispatchEvent(new Event("visible"))):setTimeout(()=>{var e;(e=this._previousContainer)==null||e.append(this),this._previousContainer=null,this.style.setProperty("display","none"),this.dispatchEvent(new Event("hidden"))},310)}async updatePosition(){if(!(this.visible&&this._previousContainer))return;const t=this.placement??"right",e=await $a(this._previousContainer,this,{placement:t,middleware:[ma(10),wa(),va(),ya({padding:5})]}),{x:i,y:n}=e;this.style.left=`${i}px`,this.style.top=`${n}px`}connectedCallback(){super.connectedCallback(),this.visible?(this.style.setProperty("width","auto"),this.style.setProperty("height","auto")):(this.style.setProperty("display","none"),this.style.setProperty("width","0"),this.style.setProperty("height","0"))}render(){return C` <slot></slot> `}},$e.styles=[Wt.scrollbar,Q`
      :host {
        pointer-events: auto;
        position: absolute;
        top: 0;
        left: 0;
        z-index: 999;
        overflow: auto;
        max-height: 20rem;
        min-width: 3rem;
        flex-direction: column;
        box-shadow: 1px 2px 8px 2px rgba(0, 0, 0, 0.15);
        padding: 0.5rem;
        border-radius: var(--bim-ui_size-4xs);
        display: flex;
        transform-origin: top left;
        transform: scale(1);
        clip-path: circle(150% at top left);
        background-color: var(--bim-ui_bg-contrast-20);
        transition:
          clip-path 0.2s cubic-bezier(0.72, 0.1, 0.43, 0.93),
          transform 0.3s cubic-bezier(0.72, 0.1, 0.45, 2.35);
      }

      :host(:not([visible])) {
        transform: scale(0.8);
        clip-path: circle(0 at top left);
      }
    `],$e.dialog=Qi.create(()=>C` <dialog
      @click=${t=>{t.target===$e.dialog&&$e.removeMenus()}}
      @cancel=${()=>$e.removeMenus()}
      data-context-dialog
      style="
      width: 0;
      height: 0;
      position: relative;
      padding: 0;
      border: none;
      outline: none;
      margin: none;
      overflow: visible;
      background-color: transparent;
    "
    ></dialog>`),$e);hu([_({type:String,reflect:!0})],za.prototype,"placement");hu([_({type:Boolean,reflect:!0})],za.prototype,"visible");let Ho=za;var Hb=Object.defineProperty,qb=Object.getOwnPropertyDescriptor,ot=(t,e,i,n)=>{for(var o=n>1?void 0:n?qb(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&Hb(e,i,o),o},kn;const We=(kn=class extends Z{constructor(){super(),this.labelHidden=!1,this.active=!1,this.disabled=!1,this.vertical=!1,this.tooltipVisible=!1,this._stateBeforeLoading={disabled:!1,icon:""},this._loading=!1,this._parent=Ki(),this._tooltip=Ki(),this._mouseLeave=!1,this.onClick=t=>{t.stopPropagation(),this.disabled||this.dispatchEvent(new Event("click"))},this.showContextMenu=()=>{let t=this._contextMenu;if(this.contextMenuTemplate&&(t=Qi.create(()=>{const e=Qi.create(this.contextMenuTemplate);return e instanceof Ho?C`${e}`:C`
          <bim-context-menu>${e}</bim-context-menu>
        `}),this.append(t),t.addEventListener("hidden",()=>{t?.remove()})),t){const e=this.getAttribute("data-context-group");e&&t.setAttribute("data-context-group",e),this.closeNestedContexts();const i=Mr.newRandomId();for(const n of t.children)n instanceof kn&&n.setAttribute("data-context-group",i);t.visible=!0}},this.mouseLeave=!0}set loading(t){if(this._loading=t,t)this._stateBeforeLoading={disabled:this.disabled,icon:this.icon},this.disabled=t,this.icon="eos-icons:loading";else{const{disabled:e,icon:i}=this._stateBeforeLoading;this.disabled=e,this.icon=i}}get loading(){return this._loading}set mouseLeave(t){this._mouseLeave=t,t&&(this.tooltipVisible=!1,clearTimeout(this.timeoutID))}get mouseLeave(){return this._mouseLeave}computeTooltipPosition(){const{value:t}=this._parent,{value:e}=this._tooltip;t&&e&&$a(t,e,{placement:"bottom",middleware:[ma(10),wa(),va(),ya({padding:5})]}).then(i=>{const{x:n,y:o}=i;Object.assign(e.style,{left:`${n}px`,top:`${o}px`})})}onMouseEnter(){if(!(this.tooltipTitle||this.tooltipText))return;this.mouseLeave=!1;const t=this.tooltipTime??700;this.timeoutID=setTimeout(()=>{this.mouseLeave||(this.computeTooltipPosition(),this.tooltipVisible=!0)},t)}closeNestedContexts(){const t=this.getAttribute("data-context-group");if(t)for(const e of Ho.dialog.children){const i=e.getAttribute("data-context-group");if(e instanceof Ho&&i===t){e.visible=!1,e.removeAttribute("data-context-group");for(const n of e.children)n instanceof kn&&(n.closeNestedContexts(),n.removeAttribute("data-context-group"))}}}click(){this.disabled||super.click()}get _contextMenu(){return this.querySelector("bim-context-menu")}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this.showContextMenu)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("click",this.showContextMenu)}render(){const t=C`
      <div ${mt(this._tooltip)} class="tooltip">
        ${this.tooltipTitle?C`<p style="text-wrap: nowrap;">
              <strong>${this.tooltipTitle}</strong>
            </p>`:null}
        ${this.tooltipText?C`<p style="width: 9rem;">${this.tooltipText}</p>`:null}
      </div>
    `;let e=C`${this.label}`;if((this._contextMenu||this.contextMenuTemplate)&&this.label){const i=C`<svg
        xmlns="http://www.w3.org/2000/svg"
        height="1.125rem"
        viewBox="0 0 24 24"
        width="1.125rem"
        style="fill: var(--bim-label--c)"
      >
        <path d="M0 0h24v24H0V0z" fill="none" />
        <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
      </svg>`;e=C`
        <div style="display: flex; align-items: center;">
          ${this.label}
          ${i}
        </div>
      `}return C`
      <div ${mt(this._parent)} class="parent" @click=${this.onClick}>
        ${this.label||this.icon?C`
              <div
                class="button"
                @mouseenter=${this.onMouseEnter}
                @mouseleave=${()=>this.mouseLeave=!0}
              >
                <bim-label
                  .icon=${this.icon}
                  .vertical=${this.vertical}
                  .labelHidden=${this.labelHidden}
                  >${e}</bim-label
                >
              </div>
            `:null}
        ${this.tooltipTitle||this.tooltipText?t:null}
      </div>
      <slot></slot>
    `}},kn.styles=Q`
    :host {
      --bim-label--c: var(--bim-ui_bg-contrast-100, white);
      position: relative;
      display: block;
      flex: 1;
      pointer-events: none;
      background-color: var(--bim-button--bgc, var(--bim-ui_bg-contrast-20));
      border-radius: var(--bim-ui_size-4xs);
      transition: all 0.15s;
    }

    :host(:not([disabled]))::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      background-color: var(--bim-ui_main-base);
      clip-path: circle(0 at center center);
      box-sizing: border-box;
      transition:
        clip-path 0.3s cubic-bezier(0.65, 0.05, 0.36, 1),
        transform 0.15s;
    }

    :host(:not([disabled]):hover) {
      cursor: pointer;
    }

    bim-label {
      pointer-events: none;
    }

    .parent {
      --bim-icon--c: var(--bim-label--c);
      position: relative;
      display: flex;
      height: 100%;
      user-select: none;
      row-gap: 0.125rem;
      min-height: var(--bim-ui_size-5xl);
      min-width: var(--bim-ui_size-5xl);
    }

    .button,
    .children {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
    }

    .children {
      padding: 0 0.375rem;
      position: absolute;
      height: 100%;
      right: 0;
    }

    :host(:not([label-hidden])[icon][vertical]) .parent {
      min-height: 2.5rem;
    }

    .button {
      flex-grow: 1;
      transition: transform 0.15s;
    }

    :host(:not([label-hidden])[label]) .button {
      justify-content: var(--bim-button--jc, center);
    }

    :host(:hover)::before {
      clip-path: circle(120% at center center);
    }

    :host(:hover) {
      --bim-label--c: var(--bim-ui_main-contrast);
      z-index: 2;
    }

    :host([active]) {
      background-color: var(--bim-ui_main-base);
    }

    :host(:not([disabled]):active) {
      background: transparent;
    }

    :host(:not([disabled]):active) .button,
    :host(:not([disabled]):active)::before {
      transform: scale(0.98);
    }

    :host(:not([label]):not([icon])) .children {
      flex: 1;
    }

    :host([vertical]) .parent {
      justify-content: center;
    }

    :host(:not([label-hidden])[label]) .button {
      padding: 0 0.5rem;
    }

    :host([disabled]) {
      --bim-label--c: var(--bim-ui_bg-contrast-80) !important;
      background-color: gray !important;
    }

    ::slotted(bim-button) {
      --bim-icon--fz: var(--bim-ui_size-base);
      --bim-button--bdrs: var(--bim-ui_size-4xs);
      --bim-button--olw: 0;
      --bim-button--olc: transparent;
    }

    .tooltip {
      position: absolute;
      padding: 0.75rem;
      z-index: 99;
      display: flex;
      flex-flow: column;
      row-gap: 0.375rem;
      box-shadow: 0 0 10px 3px rgba(0 0 0 / 20%);
      outline: 1px solid var(--bim-ui_bg-contrast-40);
      font-size: var(--bim-ui_size-xs);
      border-radius: var(--bim-ui_size-4xs);
      background-color: var(--bim-ui_bg-contrast-20);
      color: var(--bim-ui_bg-contrast-100);
      animation: openTooltips 0.15s ease-out forwards;
      transition: visibility 0.2s;
    }

    .tooltip p {
      margin: 0;
      padding: 0;
    }

    :host(:not([tooltip-visible])) .tooltip {
      animation: closeTooltips 0.15s ease-in forwards;
      visibility: hidden;
      display: none;
    }

    @keyframes closeTooltips {
      0% {
        display: flex;
        padding: 0.75rem;
        transform: translateY(0);
        opacity: 1;
      }
      90% {
        padding: 0.75rem;
      }
      100% {
        display: none;
        padding: 0;
        transform: translateY(-10px);
        opacity: 0;
      }
    }

    @keyframes openTooltips {
      0% {
        display: flex;
        transform: translateY(-10px);
        opacity: 0;
      }
      100% {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `,kn);ot([_({type:String,reflect:!0})],We.prototype,"label",2);ot([_({type:Boolean,attribute:"label-hidden",reflect:!0})],We.prototype,"labelHidden",2);ot([_({type:Boolean,reflect:!0})],We.prototype,"active",2);ot([_({type:Boolean,reflect:!0,attribute:"disabled"})],We.prototype,"disabled",2);ot([_({type:String,reflect:!0})],We.prototype,"icon",2);ot([_({type:Boolean,reflect:!0})],We.prototype,"vertical",2);ot([_({type:Number,attribute:"tooltip-time",reflect:!0})],We.prototype,"tooltipTime",2);ot([_({type:Boolean,attribute:"tooltip-visible",reflect:!0})],We.prototype,"tooltipVisible",2);ot([_({type:String,attribute:"tooltip-title",reflect:!0})],We.prototype,"tooltipTitle",2);ot([_({type:String,attribute:"tooltip-text",reflect:!0})],We.prototype,"tooltipText",2);ot([_({type:Boolean,reflect:!0})],We.prototype,"loading",1);let Vb=We;var Gb=Object.defineProperty,mo=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&Gb(e,i,o),o};const pu=class extends Z{constructor(){super(...arguments),this.checked=!1,this.inverted=!1,this.onValueChange=new Event("change")}get value(){return this.checked}onChange(e){e.stopPropagation(),this.checked=e.target.checked,this.dispatchEvent(this.onValueChange)}render(){const e=C`
      <svg viewBox="0 0 21 21">
        <polyline points="5 10.75 8.5 14.25 16 6"></polyline>
      </svg>
    `;return C`
      <div class="parent">
        <label class="parent-label">
          ${this.label?C`<bim-label .icon="${this.icon}">${this.label}</bim-label> `:null}
          <div class="input-container">
            <input
              type="checkbox"
              aria-label=${this.label||this.name||"Checkbox Input"}
              @change="${this.onChange}"
              .checked="${this.checked}"
            />
            ${e}
          </div>
        </label>
      </div>
    `}};pu.styles=Q`
    :host {
      display: block;
    }

    .parent-label {
      --background: #fff;
      --border: #dfdfe6;
      --stroke: #fff;
      --border-hover: var(--bim-ui_main-base);
      --border-active: var(--bim-ui_main-base);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      width: 100%;
      height: 1.75rem;
      column-gap: 0.25rem;
      position: relative;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    }

    :host([inverted]) .parent-label {
      flex-direction: row-reverse;
      justify-content: start;
    }

    input,
    svg {
      width: 1rem;
      height: 1rem;
      display: block;
    }

    input {
      -webkit-appearance: none;
      -moz-appearance: none;
      position: relative;
      outline: none;
      background: var(--background);
      border: none;
      margin: 0;
      padding: 0;
      cursor: pointer;
      border-radius: 4px;
      transition: box-shadow 0.3s;
      box-shadow: inset 0 0 0 var(--s, 1px) var(--b, var(--border));
    }

    svg {
      pointer-events: none;
      fill: none;
      stroke-width: 2.2px;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke: var(--stroke, var(--border-active));
      transform: translateY(-100%) scale(0);
      position: absolute;
      width: 1rem;
      height: 1rem;
    }

    input:hover {
      --s: 2px;
      --b: var(--border-hover);
    }

    input:checked {
      --b: var(--border-active);
      --s: 11px;
    }

    input:checked + svg {
      -webkit-animation: bounce 0.4s linear forwards 0.2s;
      animation: bounce 0.4s linear forwards 0.2s;
    }

    @keyframes bounce {
      0% {
        transform: translateY(-100%) scale(0);
      }
      50% {
        transform: translateY(-100%) scale(1.2);
      }
      75% {
        transform: translateY(-100%) scale(0.9);
      }
      100% {
        transform: translateY(-100%) scale(1);
      }
    }
  `;let pn=pu;mo([_({type:String,reflect:!0})],pn.prototype,"icon");mo([_({type:String,reflect:!0})],pn.prototype,"name");mo([_({type:String,reflect:!0})],pn.prototype,"label");mo([_({type:Boolean,reflect:!0})],pn.prototype,"checked");mo([_({type:Boolean,reflect:!0})],pn.prototype,"inverted");var Wb=Object.defineProperty,Si=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&Wb(e,i,o),o};const fu=class extends Z{constructor(){super(...arguments),this.vertical=!1,this.color="#bcf124",this.disabled=!1,this._colorInput=Ki(),this._textInput=Ki(),this.onValueChange=new Event("input"),this.onOpacityInput=e=>{const i=e.target;this.opacity=i.value,this.dispatchEvent(this.onValueChange)}}set value(e){const{color:i,opacity:n}=e;this.color=i,n&&(this.opacity=n)}get value(){const e={color:this.color};return this.opacity&&(e.opacity=this.opacity),e}onColorInput(e){e.stopPropagation();const{value:i}=this._colorInput;i&&(this.color=i.value,this.dispatchEvent(this.onValueChange))}onTextInput(e){e.stopPropagation();const{value:i}=this._textInput;if(!i)return;const{value:n}=i;let o=n.replace(/[^a-fA-F0-9]/g,"");o.startsWith("#")||(o=`#${o}`),i.value=o.slice(0,7),i.value.length===7&&(this.color=i.value,this.dispatchEvent(this.onValueChange))}focus(){const{value:e}=this._colorInput;e&&e.click()}render(){return C`
      <div class="parent">
        <bim-input
          .label=${this.label}
          .icon=${this.icon}
          .vertical="${this.vertical}"
        >
          <div class="color-container">
            <div
              style="display: flex; align-items: center; gap: .375rem; height: 100%; flex: 1; padding: 0 0.5rem;"
            >
              <input
                ${mt(this._colorInput)}
                @input="${this.onColorInput}"
                type="color"
                aria-label=${this.label||this.name||"Color Input"}
                value="${this.color}"
                ?disabled=${this.disabled}
              />
              <div
                @click=${this.focus}
                class="sample"
                style="background-color: ${this.color}"
              ></div>
              <input
                ${mt(this._textInput)}
                @input="${this.onTextInput}"
                value="${this.color}"
                type="text"
                aria-label=${this.label||this.name||"Text Color Input"}
                ?disabled=${this.disabled}
              />
            </div>
            ${this.opacity!==void 0?C`<bim-number-input
                  @change=${this.onOpacityInput}
                  slider
                  suffix="%"
                  min="0"
                  value=${this.opacity}
                  max="100"
                ></bim-number-input>`:null}
          </div>
        </bim-input>
      </div>
    `}};fu.styles=Q`
    :host {
      --bim-input--bgc: var(--bim-ui_bg-contrast-20);
      flex: 1;
      display: block;
    }

    :host(:focus) {
      --bim-input--olw: var(--bim-number-input--olw, 2px);
      --bim-input--olc: var(--bim-ui_accent-base);
    }

    .parent {
      display: flex;
      gap: 0.375rem;
    }

    .color-container {
      position: relative;
      outline: none;
      display: flex;
      height: 100%;
      gap: 0.5rem;
      justify-content: flex-start;
      align-items: center;
      flex: 1;
      border-radius: var(--bim-color-input--bdrs, var(--bim-ui_size-4xs));
    }

    .color-container input[type="color"] {
      position: absolute;
      bottom: -0.25rem;
      visibility: hidden;
      width: 0;
      height: 0;
    }

    .color-container .sample {
      width: 1rem;
      height: 1rem;
      border-radius: 0.125rem;
      background-color: #fff;
    }

    .color-container input[type="text"] {
      height: 100%;
      flex: 1;
      width: 3.25rem;
      text-transform: uppercase;
      font-size: 0.75rem;
      background-color: transparent;
      padding: 0%;
      outline: none;
      border: none;
      color: var(--bim-color-input--c, var(--bim-ui_bg-contrast-100));
    }

    :host([disabled]) .color-container input[type="text"] {
      color: var(--bim-ui_bg-contrast-60);
    }

    bim-number-input {
      flex-grow: 0;
    }
  `;let Yt=fu;Si([_({type:String,reflect:!0})],Yt.prototype,"name");Si([_({type:String,reflect:!0})],Yt.prototype,"label");Si([_({type:String,reflect:!0})],Yt.prototype,"icon");Si([_({type:Boolean,reflect:!0})],Yt.prototype,"vertical");Si([_({type:Number,reflect:!0})],Yt.prototype,"opacity");Si([_({type:String,reflect:!0})],Yt.prototype,"color");Si([_({type:Boolean,reflect:!0})],Yt.prototype,"disabled");var Yb=Object.defineProperty,Xb=Object.getOwnPropertyDescriptor,Xt=(t,e,i,n)=>{for(var o=n>1?void 0:n?Xb(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&Yb(e,i,o),o};const mu=class extends Z{constructor(){super(...arguments),this.checked=!1,this.checkbox=!1,this.noMark=!1,this.vertical=!1}get value(){return this._value!==void 0?this._value:this.label?Dr(this.label):this.label}set value(e){this._value=e}render(){return C`
      <div class="parent" .title=${this.label??""}>
        ${this.img||this.icon||this.label?C` <div style="display: flex; column-gap: 0.375rem">
              ${this.checkbox&&!this.noMark?C`<bim-checkbox
                    style="pointer-events: none"
                    .checked=${this.checked}
                  ></bim-checkbox>`:null}
              <bim-label
                .vertical=${this.vertical}
                .icon=${this.icon}
                .img=${this.img}
                >${this.label}</bim-label
              >
            </div>`:null}
        ${!this.checkbox&&!this.noMark&&this.checked?C`<svg
              xmlns="http://www.w3.org/2000/svg"
              height="1.125rem"
              viewBox="0 0 24 24"
              width="1.125rem"
              fill="#FFFFFF"
            >
              <path d="M0 0h24v24H0z" fill="none" />
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>`:null}
        <slot></slot>
      </div>
    `}};mu.styles=Q`
    :host {
      --bim-label--c: var(--bim-ui_bg-contrast-100);
      display: block;
      box-sizing: border-box;
      flex: 1;
      padding: 0rem 0.5rem;
      border-radius: var(--bim-ui_size-4xs);
      transition: all 0.15s;
    }

    :host(:hover) {
      cursor: pointer;
    }

    :host([checked]) {
      --bim-label--c: color-mix(in lab, var(--bim-ui_main-base), white 30%);
    }

    :host([checked]) svg {
      fill: color-mix(in lab, var(--bim-ui_main-base), white 30%);
    }

    .parent {
      box-sizing: border-box;
      display: flex;
      justify-content: var(--bim-option--jc, space-between);
      column-gap: 0.5rem;
      align-items: center;
      min-height: 1.75rem;
      height: 100%;
    }

    input {
      height: 1rem;
      width: 1rem;
      cursor: pointer;
      border: none;
      outline: none;
      accent-color: var(--bim-checkbox--c, var(--bim-ui_main-base));
    }

    input:focus {
      outline: var(--bim-checkbox--olw, 2px) solid
        var(--bim-checkbox--olc, var(--bim-ui_accent-base));
    }

    bim-label {
      pointer-events: none;
      z-index: 1;
    }
  `;let ue=mu;Xt([_({type:String,reflect:!0})],ue.prototype,"img",2);Xt([_({type:String,reflect:!0})],ue.prototype,"label",2);Xt([_({type:String,reflect:!0})],ue.prototype,"icon",2);Xt([_({type:Boolean,reflect:!0})],ue.prototype,"checked",2);Xt([_({type:Boolean,reflect:!0})],ue.prototype,"checkbox",2);Xt([_({type:Boolean,attribute:"no-mark",reflect:!0})],ue.prototype,"noMark",2);Xt([_({converter:{fromAttribute(t){return t&&Dr(t)}}})],ue.prototype,"value",1);Xt([_({type:Boolean,reflect:!0})],ue.prototype,"vertical",2);var Zb=Object.defineProperty,Jb=Object.getOwnPropertyDescriptor,yt=(t,e,i,n)=>{for(var o=n>1?void 0:n?Jb(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&Zb(e,i,o),o};const bu=class extends Qi{constructor(){super(),this.multiple=!1,this.required=!1,this.vertical=!1,this._visible=!1,this._value=new Set,this.onValueChange=new Event("change"),this._contextMenu=Ki(),this.onOptionClick=e=>{const i=e.target,n=this._value.has(i);if(!this.multiple&&!this.required&&!n)this._value=new Set([i]);else if(!this.multiple&&!this.required&&n)this._value=new Set([]);else if(!this.multiple&&this.required&&!n)this._value=new Set([i]);else if(this.multiple&&!this.required&&!n)this._value=new Set([...this._value,i]);else if(this.multiple&&!this.required&&n){const o=[...this._value].filter(r=>r!==i);this._value=new Set(o)}else if(this.multiple&&this.required&&!n)this._value=new Set([...this._value,i]);else if(this.multiple&&this.required&&n){const o=[...this._value].filter(s=>s!==i),r=new Set(o);r.size!==0&&(this._value=r)}this.updateOptionsState(),this.dispatchEvent(this.onValueChange)},this.onSearch=({target:e})=>{const i=e.value.toLowerCase();for(const n of this._options)n instanceof ue&&((n.label||n.value||"").toLowerCase().includes(i)?n.style.display="":n.style.display="none")},this.useObserver=!0}set visible(e){var i;if(e){const{value:n}=this._contextMenu;if(!n)return;for(const o of this.elements)n.append(o);this._visible=!0}else{for(const o of this.elements)this.append(o);this._visible=!1,this.resetVisibleElements();for(const o of this._options)o instanceof ue&&(o.style.display="");const n=(i=this._contextMenu.value)==null?void 0:i.querySelector("bim-text-input");n&&(n.value="")}}get visible(){return this._visible}set value(e){if(this.required&&Object.keys(e).length===0)return;const i=new Set;for(const n of e){const o=this.findOption(n);if(o&&(i.add(o),!this.multiple&&Object.keys(e).length===1))break}this._value=i,this.updateOptionsState(),this.dispatchEvent(this.onValueChange)}get value(){return[...this._value].filter(e=>e instanceof ue&&e.checked).map(e=>e.value)}get _options(){const e=new Set([...this.elements]);for(const i of this.children)i instanceof ue&&e.add(i);return[...e]}onSlotChange(e){const i=e.target.assignedElements();this.observe(i);const n=new Set;for(const o of this.elements){if(!(o instanceof ue)){o.remove();continue}o.checked&&n.add(o),o.removeEventListener("click",this.onOptionClick),o.addEventListener("click",this.onOptionClick)}this._value=n}updateOptionsState(){for(const e of this._options)e instanceof ue&&(e.checked=this._value.has(e))}findOption(e){return this._options.find(i=>i instanceof ue?i.label===e||i.value===e:!1)}render(){let e,i,n;if(this._value.size===0)e=this.placeholder??"Select an option...";else if(this._value.size===1){const o=[...this._value][0];e=o?.label||o?.value,i=o?.img,n=o?.icon}else e=`Multiple (${this._value.size})`;return C`
      <bim-input
        title=${this.label??""}
        .label=${this.label}
        .icon=${this.icon}
        .vertical=${this.vertical}
      >
        <div class="input" @click=${()=>this.visible=!this.visible}>
          <bim-label
            .img=${i}
            .icon=${n}
            style="overflow: hidden;"
            >${e}</bim-label
          >
          <svg
            style="flex-shrink: 0; fill: var(--bim-dropdown--c, var(--bim-ui_bg-contrast-100))"
            xmlns="http://www.w3.org/2000/svg"
            height="1.125rem"
            viewBox="0 0 24 24"
            width="1.125rem"
            fill="#9ca3af"
          >
            <path d="M0 0h24v24H0V0z" fill="none" />
            <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
          </svg>
          <bim-context-menu
            ${mt(this._contextMenu)}
            .visible=${this.visible}
            @hidden=${()=>{this.visible&&(this.visible=!1)}}
          >
            ${this.searchBox?C`<bim-text-input @input=${this.onSearch} placeholder="Search..." debounce=200 style="--bim-input--bgc: var(--bim-ui_bg-contrast-30)"></bim-text-input>`:ie}
            <slot @slotchange=${this.onSlotChange}></slot>
          </bim-context-menu>
        </div>
      </bim-input>
    `}};bu.styles=[Wt.scrollbar,Q`
      :host {
        --bim-input--bgc: var(
          --bim-dropdown--bgc,
          var(--bim-ui_bg-contrast-20)
        );
        --bim-input--olw: 2px;
        --bim-input--olc: transparent;
        --bim-input--bdrs: var(--bim-ui_size-4xs);
        flex: 1;
        display: block;
      }

      :host([visible]) {
        --bim-input--olc: var(--bim-ui_accent-base);
      }

      .input {
        --bim-label--fz: var(--bim-drodown--fz, var(--bim-ui_size-xs));
        --bim-label--c: var(--bim-dropdown--c, var(--bim-ui_bg-contrast-100));
        height: 100%;
        display: flex;
        flex: 1;
        overflow: hidden;
        column-gap: 0.25rem;
        outline: none;
        cursor: pointer;
        align-items: center;
        justify-content: space-between;
        padding: 0 0.5rem;
      }

      bim-label {
        pointer-events: none;
      }
    `];let rt=bu;yt([_({type:String,reflect:!0})],rt.prototype,"name",2);yt([_({type:String,reflect:!0})],rt.prototype,"icon",2);yt([_({type:String,reflect:!0})],rt.prototype,"label",2);yt([_({type:Boolean,reflect:!0})],rt.prototype,"multiple",2);yt([_({type:Boolean,reflect:!0})],rt.prototype,"required",2);yt([_({type:Boolean,reflect:!0})],rt.prototype,"vertical",2);yt([_({type:String,reflect:!0})],rt.prototype,"placeholder",2);yt([_({type:Boolean,reflect:!0,attribute:"search-box"})],rt.prototype,"searchBox",2);yt([_({type:Boolean,reflect:!0})],rt.prototype,"visible",1);yt([Ei()],rt.prototype,"_value",2);var Kb=Object.defineProperty,gu=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&Kb(e,i,o),o};const yu=class extends Z{constructor(){super(...arguments),this.floating=!1,this._layouts={},this._elements={},this._templateIds=new Map,this._updateFunctions={},this._slotNames={notAllowed:"not-allowed",notFound:"not-found",emptyLayout:"empty-layout"},this.updateComponent={},this.emitLayoutChange=()=>{this.dispatchEvent(new Event("layoutchange"))}}set layouts(e){this._layouts=e,this._templateIds.clear()}get layouts(){return this._layouts}set elements(e){this._elements=e,this.setUpdateFunctions()}get elements(){return this._elements}getLayoutAreas(e){const{template:i}=e,n=i.split(`
`).map(o=>o.trim()).map(o=>o.split('"')[1]).filter(o=>o!==void 0).flatMap(o=>o.split(/\s+/));return[...new Set(n)].filter(o=>o!=="")}setUpdateFunctions(){const e={};for(const[i,n]of Object.entries(this.elements))"template"in n&&(e[i]=o=>{var r,s;(s=(r=this._updateFunctions)[i])==null||s.call(r,o)});this.updateComponent=e}disconnectedCallback(){super.disconnectedCallback(),this._templateIds.clear(),this._updateFunctions={},this.updateComponent={}}getTemplateId(e){let i=this._templateIds.get(e);return i||(i=Mr.newRandomId(),this._templateIds.set(e,i)),i}cleanUpdateFunctions(){if(!this.layout){this._updateFunctions={};return}const e=this.layouts[this.layout],i=this.getLayoutAreas(e);for(const n in this.elements)i.includes(n)||delete this._updateFunctions[n]}clean(){this.style.gridTemplate="";for(const e of[...this.children])Object.values(this._slotNames).some(i=>e.getAttribute("slot")===i)||e.remove();this.cleanUpdateFunctions()}emitElementCreation(e){this.dispatchEvent(new CustomEvent("elementcreated",{detail:e}))}render(){if(this.layout){const e=this.layouts[this.layout];if(e){if(!(e.guard??(()=>!0))())return this.clean(),C`<slot name=${this._slotNames.notAllowed}></slot>`;const i=this.getLayoutAreas(e).map(n=>{var o;const r=((o=e.elements)==null?void 0:o[n])||this.elements[n];if(!r)return null;if(r instanceof HTMLElement)return r.style.gridArea=n,r;if("template"in r){const{template:c,initialState:d}=r,u=this.getTemplateId(c),h=this.querySelector(`[data-grid-template-id="${u}"]`);if(h)return h;const[p,m]=Qi.create(c,d);return this.emitElementCreation({name:n,element:p}),p.setAttribute("data-grid-template-id",u),p.style.gridArea=n,this._updateFunctions[n]=m,p}const s=this.getTemplateId(r),a=this.querySelector(`[data-grid-template-id="${s}"]`);if(a)return a;const l=Qi.create(r);return this.emitElementCreation({name:n,element:l}),l.setAttribute("data-grid-template-id",this.getTemplateId(r)),l.style.gridArea=n,l}).filter(n=>n!==null);this.clean(),this.style.gridTemplate=e.template,this.append(...i),this.emitLayoutChange()}else return this.clean(),C`<slot name=${this._slotNames.notFound}></slot>`}else return this.clean(),this.emitLayoutChange(),C`<slot name=${this._slotNames.emptyLayout}></slot>`;return C`${C`<slot></slot>`}`}};yu.styles=Q`
    :host {
      display: grid;
      height: 100%;
      width: 100%;
      overflow: hidden;
      box-sizing: border-box;
    }

    /* :host(:not([layout])) {
      display: none;
    } */

    :host([floating]) {
      --bim-panel--bdrs: var(--bim-ui_size-4xs);
      background-color: transparent;
      padding: 1rem;
      gap: 1rem;
      position: absolute;
      pointer-events: none;
      top: 0px;
      left: 0px;
    }

    :host(:not([floating])) {
      --bim-panel--bdrs: 0;
      background-color: var(--bim-ui_bg-contrast-20);
      gap: 1px;
    }
  `;let La=yu;gu([_({type:Boolean,reflect:!0})],La.prototype,"floating");gu([_({type:String,reflect:!0})],La.prototype,"layout");const Us=class extends Z{render(){return C`
      <iconify-icon .icon=${this.icon} height="none"></iconify-icon>
    `}};Us.styles=Q`
    :host {
      height: var(--bim-icon--fz, var(--bim-ui_size-sm));
      width: var(--bim-icon--fz, var(--bim-ui_size-sm));
    }

    iconify-icon {
      height: var(--bim-icon--fz, var(--bim-ui_size-sm));
      width: var(--bim-icon--fz, var(--bim-ui_size-sm));
      color: var(--bim-icon--c);
      transition: all 0.15s;
      display: flex;
    }
  `,Us.properties={icon:{type:String}};let Qb=Us;var eg=Object.defineProperty,jr=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&eg(e,i,o),o};const vu=class extends Z{constructor(){super(...arguments),this.vertical=!1,this.onValueChange=new Event("change")}get value(){const e={};for(const i of this.children){const n=i;"value"in n?e[n.name||n.label]=n.value:"checked"in n&&(e[n.name||n.label]=n.checked)}return e}set value(e){const i=[...this.children];for(const n in e){const o=i.find(a=>{const l=a;return l.name===n||l.label===n});if(!o)continue;const r=o,s=e[n];typeof s=="boolean"?r.checked=s:r.value=s}}render(){return C`
      <div class="parent">
        ${this.label||this.icon?C`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
        <div class="input">
          <slot></slot>
        </div>
      </div>
    `}};vu.styles=Q`
    :host {
      flex: 1;
      display: block;
    }

    .parent {
      display: flex;
      flex-wrap: wrap;
      column-gap: 1rem;
      row-gap: 0.375rem;
      user-select: none;
      flex: 1;
    }

    :host(:not([vertical])) .parent {
      justify-content: space-between;
    }

    :host([vertical]) .parent {
      flex-direction: column;
    }

    .input {
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      min-height: 1.75rem;
      min-width: 3rem;
      gap: var(--bim-input--g, var(--bim-ui_size-4xs));
      padding: var(--bim-input--p, 0);
      background-color: var(--bim-input--bgc, transparent);
      border: var(--bim-input--olw, 2px) solid
        var(--bim-input--olc, transparent);
      border-radius: var(--bim-input--bdrs, var(--bim-ui_size-4xs));
      transition: all 0.15s;
    }

    :host(:not([vertical])) .input {
      flex: 1;
      justify-content: flex-end;
    }

    :host(:not([vertical])[label]) .input {
      max-width: fit-content;
    }
  `;let bo=vu;jr([_({type:String,reflect:!0})],bo.prototype,"name");jr([_({type:String,reflect:!0})],bo.prototype,"label");jr([_({type:String,reflect:!0})],bo.prototype,"icon");jr([_({type:Boolean,reflect:!0})],bo.prototype,"vertical");/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function Fi(t,e,i){return t?e(t):i?.(t)}/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Hs=t=>t??ie;var tg=Object.defineProperty,go=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&tg(e,i,o),o};const wu=class extends Z{constructor(){super(...arguments),this.labelHidden=!1,this.iconHidden=!1,this.vertical=!1,this._imgTemplate=()=>C`<img src=${Hs(this.img)} .alt=${this.textContent||""} />`,this._iconTemplate=()=>C`<bim-icon .icon=${this.icon}></bim-icon>`}get value(){return this.textContent?Dr(this.textContent):this.textContent}render(){return C`
      <div class="parent" title=${this.textContent}>
        ${Fi(this.img,this._imgTemplate,()=>ie)}
        ${Fi(!this.iconHidden&&this.icon,this._iconTemplate,()=>ie)}
        <p><slot></slot></p>
      </div>
    `}};wu.styles=Q`
    :host {
      --bim-icon--c: var(--bim-label--ic);
      overflow: auto;
      color: var(--bim-label--c, var(--bim-ui_bg-contrast-60));
      font-size: var(--bim-label--fz, var(--bim-ui_size-xs));
      display: block;
      white-space: nowrap;
      transition: all 0.15s;
      user-select: none;
    }

    :host([icon]) {
      line-height: 1.1rem;
    }

    .parent {
      display: flex;
      align-items: center;
      column-gap: 0.25rem;
      row-gap: 0.125rem;
      height: 100%;
    }

    :host([vertical]) .parent {
      flex-direction: column;
    }

    .parent p {
      margin: 0;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    :host([label-hidden]) .parent p,
    :host(:empty) .parent p {
      display: none;
    }

    img {
      height: 100%;
      aspect-ratio: 1;
      border-radius: 100%;
      margin-right: 0.125rem;
    }

    :host(:not([vertical])) img {
      max-height: var(
        --bim-label_icon--sz,
        calc(var(--bim-label--fz, var(--bim-ui_size-xs)) * 1.8)
      );
    }

    :host([vertical]) img {
      max-height: var(
        --bim-label_icon--sz,
        calc(var(--bim-label--fz, var(--bim-ui_size-xs)) * 4)
      );
    }
  `;let fn=wu;go([_({type:String,reflect:!0})],fn.prototype,"img");go([_({type:Boolean,attribute:"label-hidden",reflect:!0})],fn.prototype,"labelHidden");go([_({type:String,reflect:!0})],fn.prototype,"icon");go([_({type:Boolean,attribute:"icon-hidden",reflect:!0})],fn.prototype,"iconHidden");go([_({type:Boolean,reflect:!0})],fn.prototype,"vertical");var ig=Object.defineProperty,ng=Object.getOwnPropertyDescriptor,Ye=(t,e,i,n)=>{for(var o=n>1?void 0:n?ng(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&ig(e,i,o),o};const $u=class extends Z{constructor(){super(...arguments),this._value=0,this.vertical=!1,this.slider=!1,this._input=Ki(),this.onValueChange=new Event("change")}set value(e){this.setValue(e.toString())}get value(){return this._value}onChange(e){e.stopPropagation();const{value:i}=this._input;i&&this.setValue(i.value)}setValue(e){const{value:i}=this._input;let n=e;if(n=n.replace(/[^0-9.-]/g,""),n=n.replace(/(\..*)\./g,"$1"),n.endsWith(".")||(n.lastIndexOf("-")>0&&(n=n[0]+n.substring(1).replace(/-/g,"")),n==="-"||n==="-0"))return;let o=Number(n);Number.isNaN(o)||(o=this.min!==void 0?Math.max(o,this.min):o,o=this.max!==void 0?Math.min(o,this.max):o,this.value!==o&&(this._value=o,i&&(i.value=this.value.toString()),this.requestUpdate(),this.dispatchEvent(this.onValueChange)))}onBlur(){const{value:e}=this._input;e&&Number.isNaN(Number(e.value))&&(e.value=this.value.toString())}onSliderMouseDown(e){document.body.style.cursor="w-resize";const{clientX:i}=e,n=this.value;let o=!1;const r=l=>{var c;o=!0;const{clientX:d}=l,u=this.step??1,h=((c=u.toString().split(".")[1])==null?void 0:c.length)||0,p=1/(this.sensitivity??1),m=(d-i)/p;if(Math.floor(Math.abs(m))!==Math.abs(m))return;const g=n+m*u;this.setValue(g.toFixed(h))},s=()=>{this.slider=!0,this.removeEventListener("blur",s)},a=()=>{document.removeEventListener("mousemove",r),document.body.style.cursor="default",o?o=!1:(this.addEventListener("blur",s),this.slider=!1,requestAnimationFrame(()=>this.focus())),document.removeEventListener("mouseup",a)};document.addEventListener("mousemove",r),document.addEventListener("mouseup",a)}onFocus(e){e.stopPropagation();const i=n=>{n.key==="Escape"&&(this.blur(),window.removeEventListener("keydown",i))};window.addEventListener("keydown",i)}connectedCallback(){super.connectedCallback(),this.min&&this.min>this.value&&(this._value=this.min),this.max&&this.max<this.value&&(this._value=this.max)}focus(){const{value:e}=this._input;e&&e.focus()}render(){const e=C`
      ${this.pref||this.icon?C`<bim-label
            style="pointer-events: auto"
            @mousedown=${this.onSliderMouseDown}
            .icon=${this.icon}
            >${this.pref}</bim-label
          >`:null}
      <input
        ${mt(this._input)}
        type="text"
        aria-label=${this.label||this.name||"Number Input"}
        size="1"
        @input=${a=>a.stopPropagation()}
        @change=${this.onChange}
        @blur=${this.onBlur}
        @focus=${this.onFocus}
        .value=${this.value.toString()}
      />
      ${this.suffix?C`<bim-label
            style="pointer-events: auto"
            @mousedown=${this.onSliderMouseDown}
            >${this.suffix}</bim-label
          >`:null}
    `,i=this.min??-1/0,n=this.max??1/0,o=100*(this.value-i)/(n-i),r=C`
      <style>
        .slider-indicator {
          width: ${`${o}%`};
        }
      </style>
      <div class="slider" @mousedown=${this.onSliderMouseDown}>
        <div class="slider-indicator"></div>
        ${this.pref||this.icon?C`<bim-label
              style="z-index: 1; margin-right: 0.125rem"
              .icon=${this.icon}
              >${`${this.pref}: `}</bim-label
            >`:null}
        <bim-label style="z-index: 1;">${this.value}</bim-label>
        ${this.suffix?C`<bim-label style="z-index: 1;">${this.suffix}</bim-label>`:null}
      </div>
    `,s=`${this.label||this.name||this.pref?`${this.label||this.name||this.pref}: `:""}${this.value}${this.suffix??""}`;return C`
      <bim-input
        title=${s}
        .label=${this.label}
        .icon=${this.icon}
        .vertical=${this.vertical}
      >
        ${this.slider?r:e}
      </bim-input>
    `}};$u.styles=Q`
    :host {
      --bim-input--bgc: var(
        --bim-number-input--bgc,
        var(--bim-ui_bg-contrast-20)
      );
      --bim-input--olw: var(--bim-number-input--olw, 2px);
      --bim-input--olc: var(--bim-number-input--olc, transparent);
      --bim-input--bdrs: var(--bim-number-input--bdrs, var(--bim-ui_size-4xs));
      --bim-input--p: 0 0.375rem;
      flex: 1;
      display: block;
    }

    :host(:focus) {
      --bim-input--olw: var(--bim-number-input--olw, 2px);
      --bim-input--olc: var(
        --bim-number-input¡focus--c,
        var(--bim-ui_accent-base)
      );
    }

    :host(:not([slider])) bim-label {
      --bim-label--c: var(
        --bim-number-input_affixes--c,
        var(--bim-ui_bg-contrast-60)
      );
      --bim-label--fz: var(
        --bim-number-input_affixes--fz,
        var(--bim-ui_size-xs)
      );
    }

    p {
      margin: 0;
      padding: 0;
    }

    input {
      background-color: transparent;
      outline: none;
      border: none;
      padding: 0;
      flex-grow: 1;
      text-align: right;
      font-family: inherit;
      font-feature-settings: inherit;
      font-variation-settings: inherit;
      font-size: var(--bim-number-input--fz, var(--bim-ui_size-xs));
      color: var(--bim-number-input--c, var(--bim-ui_bg-contrast-100));
    }

    :host([suffix]:not([pref])) input {
      text-align: left;
    }

    :host([slider]) {
      --bim-input--p: 0;
    }

    :host([slider]) .slider {
      --bim-label--c: var(--bim-ui_bg-contrast-100);
    }

    .slider {
      position: relative;
      display: flex;
      justify-content: center;
      width: 100%;
      height: 100%;
      padding: 0 0.5rem;
    }

    .slider-indicator {
      height: 100%;
      background-color: var(--bim-ui_main-base);
      position: absolute;
      top: 0;
      left: 0;
      border-radius: var(--bim-input--bdrs, var(--bim-ui_size-4xs));
    }

    bim-input {
      display: flex;
    }

    bim-label {
      pointer-events: none;
    }
  `;let Ne=$u;Ye([_({type:String,reflect:!0})],Ne.prototype,"name",2);Ye([_({type:String,reflect:!0})],Ne.prototype,"icon",2);Ye([_({type:String,reflect:!0})],Ne.prototype,"label",2);Ye([_({type:String,reflect:!0})],Ne.prototype,"pref",2);Ye([_({type:Number,reflect:!0})],Ne.prototype,"min",2);Ye([_({type:Number,reflect:!0})],Ne.prototype,"value",1);Ye([_({type:Number,reflect:!0})],Ne.prototype,"step",2);Ye([_({type:Number,reflect:!0})],Ne.prototype,"sensitivity",2);Ye([_({type:Number,reflect:!0})],Ne.prototype,"max",2);Ye([_({type:String,reflect:!0})],Ne.prototype,"suffix",2);Ye([_({type:Boolean,reflect:!0})],Ne.prototype,"vertical",2);Ye([_({type:Boolean,reflect:!0})],Ne.prototype,"slider",2);var og=Object.defineProperty,rg=Object.getOwnPropertyDescriptor,yo=(t,e,i,n)=>{for(var o=n>1?void 0:n?rg(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&og(e,i,o),o};const _u=class extends Z{constructor(){super(...arguments),this.onValueChange=new Event("change"),this._hidden=!1,this.headerHidden=!1,this.valueTransform={},this.activationButton=document.createElement("bim-button")}set hidden(e){this._hidden=e,this.activationButton.active=!e,this.dispatchEvent(new Event("hiddenchange"))}get hidden(){return this._hidden}get value(){return rr(this,this.valueTransform)}set value(e){const i=[...this.children];for(const n in e){const o=i.find(s=>{const a=s;return a.name===n||a.label===n});if(!o)continue;const r=o;r.value=e[n]}}animatePanles(){const e=[{maxHeight:"100vh",maxWidth:"100vw",opacity:1},{maxHeight:"100vh",maxWidth:"100vw",opacity:0},{maxHeight:0,maxWidth:0,opacity:0}];this.animate(e,{duration:300,easing:"cubic-bezier(0.65, 0.05, 0.36, 1)",direction:this.hidden?"normal":"reverse",fill:"forwards"})}connectedCallback(){super.connectedCallback(),this.activationButton.active=!this.hidden,this.activationButton.onclick=()=>{this.hidden=!this.hidden,this.animatePanles()}}disconnectedCallback(){super.disconnectedCallback(),this.activationButton.remove()}collapseSections(){const e=this.querySelectorAll("bim-panel-section");for(const i of e)i.collapsed=!0}expandSections(){const e=this.querySelectorAll("bim-panel-section");for(const i of e)i.collapsed=!1}render(){return this.activationButton.icon=this.icon,this.activationButton.label=this.label||this.name,this.activationButton.tooltipTitle=this.label||this.name,C`
      <div class="parent">
        ${this.label||this.name||this.icon?C`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
        <div class="sections">
          <slot></slot>
        </div>
      </div>
    `}};_u.styles=[Wt.scrollbar,Q`
      :host {
        display: flex;
        border-radius: var(--bim-ui_size-base);
        background-color: var(--bim-ui_bg-base);
        overflow: auto;
      }

      :host([hidden]) {
        max-height: 0;
        max-width: 0;
        opacity: 0;
      }

      .parent {
        display: flex;
        flex: 1;
        flex-direction: column;
        pointer-events: auto;
        overflow: auto;
      }

      .parent bim-label {
        --bim-label--c: var(--bim-panel--c, var(--bim-ui_bg-contrast-80));
        --bim-label--fz: var(--bim-panel--fz, var(--bim-ui_size-sm));
        font-weight: 600;
        padding: 1rem;
        flex-shrink: 0;
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([header-hidden]) .parent bim-label {
        display: none;
      }

      .sections {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: auto;
        flex: 1;
      }

      ::slotted(bim-panel-section:not(:last-child)) {
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }
    `];let Ai=_u;yo([_({type:String,reflect:!0})],Ai.prototype,"icon",2);yo([_({type:String,reflect:!0})],Ai.prototype,"name",2);yo([_({type:String,reflect:!0})],Ai.prototype,"label",2);yo([_({type:Boolean,reflect:!0})],Ai.prototype,"hidden",1);yo([_({type:Boolean,attribute:"header-hidden",reflect:!0})],Ai.prototype,"headerHidden",2);var sg=Object.defineProperty,vo=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&sg(e,i,o),o};const xu=class extends Z{constructor(){super(...arguments),this.onValueChange=new Event("change"),this.valueTransform={},this.componentHeight=-1}get value(){const e=this.parentElement;let i;return e instanceof Ai&&(i=e.valueTransform),Object.values(this.valueTransform).length!==0&&(i=this.valueTransform),rr(this,i)}set value(e){const i=[...this.children];for(const n in e){const o=i.find(s=>{const a=s;return a.name===n||a.label===n});if(!o)continue;const r=o;r.value=e[n]}}setFlexAfterTransition(){var e;const i=(e=this.shadowRoot)==null?void 0:e.querySelector(".components");i&&setTimeout(()=>{this.collapsed?i.style.removeProperty("flex"):i.style.setProperty("flex","1")},150)}animateHeader(){var e;const i=(e=this.shadowRoot)==null?void 0:e.querySelector(".components");this.componentHeight<0&&(this.collapsed?this.componentHeight=i.clientHeight:(i.style.setProperty("transition","none"),i.style.setProperty("height","auto"),i.style.setProperty("padding","0.125rem 1rem 1rem"),this.componentHeight=i.clientHeight,requestAnimationFrame(()=>{i.style.setProperty("height","0px"),i.style.setProperty("padding","0 1rem 0"),i.style.setProperty("transition","height 0.25s cubic-bezier(0.65, 0.05, 0.36, 1), padding 0.25s cubic-bezier(0.65, 0.05, 0.36, 1)")}))),this.collapsed?(i.style.setProperty("height",`${this.componentHeight}px`),requestAnimationFrame(()=>{i.style.setProperty("height","0px"),i.style.setProperty("padding","0 1rem 0")})):(i.style.setProperty("height","0px"),i.style.setProperty("padding","0 1rem 0"),requestAnimationFrame(()=>{i.style.setProperty("height",`${this.componentHeight}px`),i.style.setProperty("padding","0.125rem 1rem 1rem")})),this.setFlexAfterTransition()}onHeaderClick(){this.fixed||(this.collapsed=!this.collapsed,this.animateHeader())}handelSlotChange(e){e.target.assignedElements({flatten:!0}).forEach((i,n)=>{const o=n*.05;i.style.setProperty("transition-delay",`${o}s`)})}handlePointerEnter(){const e=this.renderRoot.querySelector(".expand-icon");this.collapsed?e?.style.setProperty("animation","collapseAnim 0.5s"):e?.style.setProperty("animation","expandAnim 0.5s")}handlePointerLeave(){const e=this.renderRoot.querySelector(".expand-icon");e?.style.setProperty("animation","none")}render(){const e=this.label||this.icon||this.name||this.fixed,i=C`<svg
      xmlns="http://www.w3.org/2000/svg"
      height="1.125rem"
      viewBox="0 0 24 24"
      width="1.125rem"
      class="expand-icon"
    >
      <path d="M0 0h24v24H0z" fill="none" />
      <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
    </svg>`,n=C`
      <div
        class="header"
        title=${this.label??""}
        @pointerenter=${this.handlePointerEnter}
        @pointerleave=${this.handlePointerLeave}
        @click=${this.onHeaderClick}
      >
        ${this.label||this.icon||this.name?C`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
        ${this.fixed?null:i}
      </div>
    `;return C`
      <div class="parent">
        ${e?n:null}
        <div class="components" style="flex: 1;">
          <div>
            <slot @slotchange=${this.handelSlotChange}></slot>
          </div>
        </div>
      </div>
    `}};xu.styles=[Wt.scrollbar,Q`
      :host {
        display: block;
        pointer-events: auto;
      }

      :host .parent {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      :host(:not([fixed])) .header:hover {
        --bim-label--c: var(--bim-ui_accent-base);
        color: var(--bim-ui_accent-base);
        cursor: pointer;
      }

      :host(:not([fixed])) .header:hover .expand-icon {
        fill: var(--bim-ui_accent-base);
      }

      .header {
        --bim-label--fz: var(--bim-ui_size-sm);
        --bim-label--c: var(
          --bim-panel-section_hc,
          var(--bim-ui_bg-contrast-80)
        );
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        height: 1.5rem;
        padding: 0.75rem 1rem;
      }

      .expand-icon {
        fill: var(--bim-ui_bg-contrast-80);
        transition: transform 0.2s;
      }

      :host([collapsed]) .expand-icon {
        transform: rotateZ(-180deg);
      }

      .title {
        display: flex;
        align-items: center;
        column-gap: 0.5rem;
      }

      .title p {
        font-size: var(--bim-ui_size-sm);
      }

      .components {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        row-gap: 0.75rem;
        padding: 0 1rem 1rem;
        box-sizing: border-box;
        transition:
          height 0.25s cubic-bezier(0.65, 0.05, 0.36, 1),
          padding 0.25s cubic-bezier(0.65, 0.05, 0.36, 1);
      }

      .components > div {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        flex: 1;
        overflow: auto;
      }

      :host(:not([icon]):not([label])) .components {
        padding: 1rem;
      }

      :host(:not([fixed])[collapsed]) .components {
        padding: 0 1rem 0;
        height: 0px;
      }

      bim-label {
        pointer-events: none;
      }

      ::slotted(*) {
        transition:
          transform 0.25s cubic-bezier(0.65, 0.05, 0.36, 1),
          opacity 0.25s cubic-bezier(0.65, 0.05, 0.36, 1);
      }

      :host(:not([fixed])[collapsed]) ::slotted(*) {
        transform: translateX(-20%);
        opacity: 0;
      }

      @keyframes expandAnim {
        0%,
        100% {
          transform: translateY(0%);
        }
        25% {
          transform: translateY(-30%);
        }
        50% {
          transform: translateY(10%);
        }
        75% {
          transform: translateY(-30%);
        }
      }

      @keyframes collapseAnim {
        0%,
        100% {
          transform: translateY(0%) rotateZ(-180deg);
        }
        25% {
          transform: translateY(30%) rotateZ(-180deg);
        }
        50% {
          transform: translateY(-10%) rotateZ(-180deg);
        }
        75% {
          transform: translateY(30%) rotateZ(-180deg);
        }
      }
    `];let mn=xu;vo([_({type:String,reflect:!0})],mn.prototype,"icon");vo([_({type:String,reflect:!0})],mn.prototype,"label");vo([_({type:String,reflect:!0})],mn.prototype,"name");vo([_({type:Boolean,reflect:!0})],mn.prototype,"fixed");vo([_({type:Boolean,reflect:!0})],mn.prototype,"collapsed");var ag=Object.defineProperty,wo=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&ag(e,i,o),o};const Eu=class extends Z{constructor(){super(...arguments),this.vertical=!1,this.onValueChange=new Event("change"),this._canEmitEvents=!1,this._value=document.createElement("bim-option"),this.onOptionClick=e=>{this._value=e.target,this.setAnimatedBackgound(),this.dispatchEvent(this.onValueChange);for(const i of this.children)i instanceof ue&&(i.checked=i===e.target)}}get _options(){return[...this.querySelectorAll("bim-option")]}set value(e){const i=this.findOption(e);if(i){for(const n of this._options)n.checked=n===i;this._value=i,this.setAnimatedBackgound(),this._canEmitEvents&&this.dispatchEvent(this.onValueChange)}}get value(){return this._value.value}onSlotChange(e){const i=e.target.assignedElements();for(const n of i)n instanceof ue&&(n.noMark=!0,n.removeEventListener("click",this.onOptionClick),n.addEventListener("click",this.onOptionClick))}findOption(e){return this._options.find(i=>i instanceof ue?i.label===e||i.value===e:!1)}doubleRequestAnimationFrames(e){requestAnimationFrame(()=>requestAnimationFrame(e))}setAnimatedBackgound(e=!1){const i=this.renderRoot.querySelector(".animated-background"),n=this._value;requestAnimationFrame(()=>{var o,r,s,a;const l=(a=(s=(r=(o=n?.parentElement)==null?void 0:o.shadowRoot)==null?void 0:r.querySelector("bim-input"))==null?void 0:s.shadowRoot)==null?void 0:a.querySelector(".input"),c={width:n?.clientWidth,height:n?.clientHeight,top:(n?.offsetTop??0)-(l?.offsetTop??0),left:(n?.offsetLeft??0)-(l?.offsetLeft??0)};i?.style.setProperty("width",`${c.width}px`),i?.style.setProperty("height",`${c.height}px`),i?.style.setProperty("top",`${c.top}px`),i?.style.setProperty("left",`${c.left}px`)}),e&&this.doubleRequestAnimationFrames(()=>{const o="ease";i?.style.setProperty("transition",`width ${.3}s ${o}, height ${.3}s ${o}, top ${.3}s ${o}, left ${.3}s ${o}`)})}firstUpdated(){const e=[...this.children].find(i=>i instanceof ue&&i.checked);e&&(this._value=e),window.addEventListener("load",()=>{this.setAnimatedBackgound(!0)}),new ResizeObserver(()=>{this.setAnimatedBackgound()}).observe(this)}render(){return C`
      <bim-input
        .vertical=${this.vertical}
        .label=${this.label}
        .icon=${this.icon}
      >
        <div class="animated-background"></div>
        <slot @slotchange=${this.onSlotChange}></slot>
      </bim-input>
    `}};Eu.styles=Q`
    :host {
      --bim-input--bgc: var(--bim-ui_bg-contrast-20);
      --bim-input--g: 0;
      --bim-option--jc: center;
      flex: 1;
      display: block;
    }

    ::slotted(bim-option) {
      position: relative;
      border-radius: 0;
      overflow: hidden;
      min-width: min-content;
      min-height: min-content;
      transition: background-color 0.2s;
    }

    .animated-background {
      position: absolute;
      background: var(--bim-ui_main-base);
      width: 0;
      height: 0;
      top: 0;
      left: 0;
    }

    ::slotted(bim-option[checked]) {
      --bim-label--c: var(--bim-ui_main-contrast);
    }

    ::slotted(bim-option:not([checked]):hover) {
      background-color: #0003;
    }
  `;let bn=Eu;wo([_({type:String,reflect:!0})],bn.prototype,"name");wo([_({type:String,reflect:!0})],bn.prototype,"icon");wo([_({type:String,reflect:!0})],bn.prototype,"label");wo([_({type:Boolean,reflect:!0})],bn.prototype,"vertical");wo([Ei()],bn.prototype,"_value");const lg=()=>C`
    <style>
      div {
        display: flex;
        gap: 0.375rem;
        border-radius: 0.25rem;
        min-height: 1.25rem;
      }

      [data-type="row"] {
        background-color: var(--bim-ui_bg-contrast-10);
        animation: row-loading 1s linear infinite alternate;
        padding: 0.5rem;
      }

      [data-type="cell"] {
        background-color: var(--bim-ui_bg-contrast-20);
        flex: 0.25;
      }

      @keyframes row-loading {
        0% {
          background-color: var(--bim-ui_bg-contrast-10);
        }
        100% {
          background-color: var(--bim-ui_bg-contrast-20);
        }
      }
    </style>
    <div style="display: flex; flex-direction: column;">
      <div data-type="row" style="gap: 2rem">
        <div data-type="cell" style="flex: 1"></div>
        <div data-type="cell" style="flex: 2"></div>
        <div data-type="cell" style="flex: 1"></div>
        <div data-type="cell" style="flex: 0.5"></div>
      </div>
      <div style="display: flex;">
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
        <div data-type="row" style="flex: 2">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
        <div data-type="row" style="flex: 1">
          <div data-type="cell"></div>
        </div>
        <div data-type="row" style="flex: 0.5">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
      </div>
      <div style="display: flex;">
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
        <div data-type="row" style="flex: 2">
          <div data-type="cell"></div>
        </div>
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
        <div data-type="row" style="flex: 0.5">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
      </div>
      <div style="display: flex;">
        <div data-type="row" style="flex: 1">
          <div data-type="cell"></div>
        </div>
        <div data-type="row" style="flex: 2">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
        <div data-type="row" style="flex: 0.5">
          <div data-type="cell" style="flex: 0.7s5"></div>
        </div>
      </div>
    </div>
  `,cg=()=>C`
    <style>
      .loader {
        grid-area: Processing;
        position: relative;
        padding: 0.125rem;
      }
      .loader:before {
        content: "";
        position: absolute;
      }
      .loader .loaderBar {
        position: absolute;
        top: 0;
        right: 100%;
        bottom: 0;
        left: 0;
        background: var(--bim-ui_main-base);
        /* width: 25%; */
        width: 0;
        animation: borealisBar 2s linear infinite;
      }

      @keyframes borealisBar {
        0% {
          left: 0%;
          right: 100%;
          width: 0%;
        }
        10% {
          left: 0%;
          right: 75%;
          width: 25%;
        }
        90% {
          right: 0%;
          left: 75%;
          width: 25%;
        }
        100% {
          left: 100%;
          right: 0%;
          width: 0%;
        }
      }
    </style>
    <div class="loader">
      <div class="loaderBar"></div>
    </div>
  `;var dg=Object.defineProperty,ug=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&dg(e,i,o),o};const Su=class extends Z{constructor(){super(...arguments),this.column="",this.columnIndex=0,this.table=null,this.group=null,this.row=null,this.rowData={}}get data(){return this.column?this.rowData[this.column]:null}get dataTransform(){var e,i,n,o;const r=(i=(e=this.row)==null?void 0:e.dataTransform)==null?void 0:i[this.column],s=(n=this.table)==null?void 0:n.dataTransform[this.column],a=(o=this.table)==null?void 0:o.defaultContentTemplate;return r||s||a}get templateValue(){const{data:e,rowData:i,group:n}=this,o=this.dataTransform;if(o&&e!=null&&n){const r=o(e,i,n);return typeof r=="string"||typeof r=="boolean"||typeof r=="number"?C`<bim-label>${r}</bim-label>`:r}return e!=null?C`<bim-label>${e}</bim-label>`:ie}connectedCallback(){super.connectedCallback(),this.style.gridArea=this.column.toString()}render(){return C`${this.templateValue}`}};Su.styles=Q`
    :host {
      padding: 0.375rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    :host([data-column-index="0"]) {
      justify-content: normal;
    }

    :host([data-column-index="0"]:not([data-cell-header]))
      ::slotted(bim-label) {
      text-align: left;
    }

    ::slotted(*) {
      --bim-input--bgc: transparent;
      --bim-input--olc: var(--bim-ui_bg-contrast-20);
      --bim-input--olw: 1px;
    }

    ::slotted(bim-input) {
      --bim-input--olw: 0;
    }
  `;let Au=Su;ug([_({type:String,reflect:!0})],Au.prototype,"column");const Cu=class extends Z{constructor(){super(...arguments),this._groups=[],this.group=this.closest("bim-table-group"),this._data=[],this.table=this.closest("bim-table")}get data(){var e;return((e=this.group)==null?void 0:e.data.children)??this._data}set data(e){this._data=e}clean(){for(const e of this._groups)e.remove();this._groups=[]}render(){return this.clean(),C`
      <slot></slot>
      ${this.data.map(e=>{const i=document.createElement("bim-table-group");return this._groups.push(i),i.table=this.table,i.data=e,i})}
    `}};Cu.styles=Q`
    :host {
      --bim-button--bgc: transparent;
      position: relative;
      display: block;
      overflow: hidden;
      grid-area: Children;
    }

    :host([hidden]) {
      height: 0;
      opacity: 0;
    }

    ::slotted(.branch.branch-vertical) {
      top: 0;
      bottom: 1.125rem;
    }
  `;let hg=Cu;/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ku="important",pg=" !"+ku,sc=Nd(class extends Fd{constructor(t){var e;if(super(t),t.type!==Bd.ATTRIBUTE||t.name!=="style"||((e=t.strings)==null?void 0:e.length)>2)throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.")}render(t){return Object.keys(t).reduce((e,i)=>{const n=t[i];return n==null?e:e+`${i=i.includes("-")?i:i.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g,"-$&").toLowerCase()}:${n};`},"")}update(t,[e]){const{style:i}=t.element;if(this.ft===void 0)return this.ft=new Set(Object.keys(e)),this.render(e);for(const n of this.ft)e[n]==null&&(this.ft.delete(n),n.includes("-")?i.removeProperty(n):i[n]=null);for(const n in e){const o=e[n];if(o!=null){this.ft.add(n);const r=typeof o=="string"&&o.endsWith(pg);n.includes("-")||r?i.setProperty(n,r?o.slice(0,-11):o,r?ku:""):i[n]=o}}return wi}});var fg=Object.defineProperty,mg=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&fg(e,i,o),o};const Tu=class extends Z{constructor(){super(...arguments),this.childrenHidden=!0,this.table=null,this.data={data:{}}}get rowElement(){const e=this.shadowRoot;return e?e.querySelector("bim-table-row"):null}get childrenElement(){const e=this.shadowRoot;return e?e.querySelector("bim-table-children"):null}get _isChildrenEmpty(){return!(this.data.children&&this.data.children.length!==0)}connectedCallback(){super.connectedCallback(),this.table&&this.table.expanded?this.childrenHidden=!1:this.childrenHidden=!0}disconnectedCallback(){super.disconnectedCallback(),this.data={data:{}}}toggleChildren(e){this.childrenHidden=typeof e>"u"?!this.childrenHidden:!e,this.animateTableChildren(!0)}animateTableChildren(e=!0){if(!e){requestAnimationFrame(()=>{var s;const a=this.renderRoot.querySelector(".caret"),l=this.renderRoot.querySelector(".branch-vertical"),c=(s=this.renderRoot.querySelector("bim-table-children"))==null?void 0:s.querySelector(".branch-vertical");a.style.setProperty("transform",`translateY(-50%) rotate(${this.childrenHidden?"0":"90"}deg)`),l.style.setProperty("transform",`scaleY(${this.childrenHidden?"0":"1"})`),c?.style.setProperty("transform",`scaleY(${this.childrenHidden?"0":"1"})`)});return}const i=500,n=0,o=200,r=350;requestAnimationFrame(()=>{var s;const a=this.renderRoot.querySelector("bim-table-children"),l=this.renderRoot.querySelector(".caret"),c=this.renderRoot.querySelector(".branch-vertical"),d=(s=this.renderRoot.querySelector("bim-table-children"))==null?void 0:s.querySelector(".branch-vertical"),u=()=>{var f;const v=(f=a?.renderRoot)==null?void 0:f.querySelectorAll("bim-table-group");v?.forEach((b,y)=>{b.style.setProperty("opacity","0"),b.style.setProperty("left","-30px");const $=[{opacity:"0",left:"-30px"},{opacity:"1",left:"0"}];b.animate($,{duration:i/2,delay:50+y*n,easing:"cubic-bezier(0.65, 0.05, 0.36, 1)",fill:"forwards"})})},h=()=>{const f=[{transform:"translateY(-50%) rotate(90deg)"},{transform:"translateY(-50%) rotate(0deg)"}];l?.animate(f,{duration:r,easing:"cubic-bezier(0.68, -0.55, 0.27, 1.55)",fill:"forwards",direction:this.childrenHidden?"normal":"reverse"})},p=()=>{const f=[{transform:"scaleY(1)"},{transform:"scaleY(0)"}];c?.animate(f,{duration:o,easing:"cubic-bezier(0.4, 0, 0.2, 1)",delay:n,fill:"forwards",direction:this.childrenHidden?"normal":"reverse"})},m=()=>{var f;const v=(f=this.renderRoot.querySelector("bim-table-row"))==null?void 0:f.querySelector(".branch-horizontal");if(v){v.style.setProperty("transform-origin","center right");const b=[{transform:"scaleX(0)"},{transform:"scaleX(1)"}];v.animate(b,{duration:o,easing:"cubic-bezier(0.4, 0, 0.2, 1)",fill:"forwards",direction:this.childrenHidden?"normal":"reverse"})}},g=()=>{const f=[{transform:"scaleY(0)"},{transform:"scaleY(1)"}];d?.animate(f,{duration:o*1.2,easing:"cubic-bezier(0.4, 0, 0.2, 1)",fill:"forwards",delay:(n+o)*.7})};u(),h(),p(),m(),g()})}firstUpdated(){this.renderRoot.querySelectorAll(".caret").forEach(e=>{var i,n,o;if(!this.childrenHidden){e.style.setProperty("transform","translateY(-50%) rotate(90deg)");const r=(i=e.parentElement)==null?void 0:i.querySelector(".branch-horizontal");r&&r.style.setProperty("transform","scaleX(0)");const s=(o=(n=e.parentElement)==null?void 0:n.parentElement)==null?void 0:o.querySelectorAll(".branch-vertical");s?.forEach(a=>{a.style.setProperty("transform","scaleY(1)")})}})}render(){if(!this.table)return C`${ie}`;const e=this.table.getGroupIndentation(this.data)??0;let i;if(!this.table.noIndentation){const s={left:`${e-1+(this.table.selectableRows?2.05:.5625)}rem`};i=C`<div style=${sc(s)} class="branch branch-horizontal"></div>`}const n=C`
      ${this.table.noIndentation?null:C`
            <style>
              .branch-vertical {
                left: ${e+(this.table.selectableRows?1.9375:.5625)}rem;
              }
            </style>
            <div class="branch branch-vertical"></div>
          `}
    `;let o;if(!this.table.noIndentation){const s=document.createElementNS("http://www.w3.org/2000/svg","svg");if(s.setAttribute("height","9.9"),s.setAttribute("width","7.5"),s.setAttribute("viewBox","0 0 4.6666672 7.7"),this.table.noCarets){const l=document.createElementNS("http://www.w3.org/2000/svg","circle");l.setAttribute("cx","2.3333336"),l.setAttribute("cy","3.85"),l.setAttribute("r","2.5"),s.append(l)}else{const l=document.createElementNS("http://www.w3.org/2000/svg","path");l.setAttribute("d","m 1.7470835,6.9583848 2.5899999,-2.59 c 0.39,-0.39 0.39,-1.02 0,-1.41 L 1.7470835,0.36838483 c -0.63,-0.62000003 -1.71000005,-0.18 -1.71000005,0.70999997 v 5.17 c 0,0.9 1.08000005,1.34 1.71000005,0.71 z"),s.append(l)}const a={left:`${(this.table.selectableRows?1.5:.125)+e}rem`,cursor:`${this.table.noCarets?"unset":"pointer"}`};o=C`<div @click=${l=>{var c;(c=this.table)!=null&&c.noCarets||(l.stopPropagation(),this.toggleChildren())}} style=${sc(a)} class="caret">${s}</div>`}let r;return!this._isChildrenEmpty&&!this.childrenHidden&&(r=C`
        <bim-table-children ${mt(s=>{if(!s)return;const a=s;a.table=this.table,a.group=this})}>${n}</bim-table-children>
      `),C`
      <div class="parent">
        <bim-table-row ${mt(s=>{var a;if(!s)return;const l=s;l.table=this.table,l.group=this,(a=this.table)==null||a.dispatchEvent(new CustomEvent("rowcreated",{detail:{row:l}}))})}>
          ${Fi(!this._isChildrenEmpty,()=>n)}
          ${Fi(e!==0,()=>i)}
          ${Fi(!this.table.noIndentation&&!this._isChildrenEmpty,()=>o)}
        </bim-table-row>
        ${r}
      </div>
    `}};Tu.styles=Q`
    :host {
      position: relative;
    }

    .parent {
      display: grid;
      grid-template-areas: "Data" "Children";
    }

    .branch {
      position: absolute;
      z-index: 1;
    }

    .branch-vertical {
      border-left: 1px dotted var(--bim-ui_bg-contrast-40);
      transform-origin: top center;
      transform: scaleY(0);
    }

    .branch-horizontal {
      top: 50%;
      width: 1rem;
      border-bottom: 1px dotted var(--bim-ui_bg-contrast-40);
    }

    .branch-horizontal {
      transform-origin: center left;
    }

    .caret {
      position: absolute;
      z-index: 2;
      transform: translateY(-50%) rotate(0deg);
      top: 50%;
      display: flex;
      width: 0.95rem;
      height: 0.95rem;
      justify-content: center;
      align-items: center;
    }

    .caret svg {
      fill: var(--bim-ui_bg-contrast-60);
    }
  `;let Ou=Tu;mg([_({type:Boolean,attribute:"children-hidden",reflect:!0})],Ou.prototype,"childrenHidden");var bg=Object.defineProperty,gn=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&bg(e,i,o),o};const Iu=class extends Z{constructor(){super(...arguments),this.selected=!1,this.columns=[],this.hiddenColumns=[],this.group=null,this._data={},this.isHeader=!1,this.table=null,this.onTableColumnsChange=()=>{this.table&&(this.columns=this.table.columns)},this.onTableColumnsHidden=()=>{this.table&&(this.hiddenColumns=this.table.hiddenColumns)},this._intersecting=!1,this._timeOutDelay=250,this._observer=new IntersectionObserver(e=>{window.clearTimeout(this._intersectTimeout),this._intersectTimeout=void 0,e[0].isIntersecting?this._intersectTimeout=window.setTimeout(()=>{this._intersecting=!0},this._timeOutDelay):this._intersecting=!1},{rootMargin:"36px"}),this.dataTransform=null,this._interval=null,this.clearDataTransform=()=>{this.dataTransform=null,this._interval!==null&&(clearInterval(this._interval),this._interval=null)},this._cache={}}get groupData(){var e;return(e=this.group)==null?void 0:e.data}get data(){var e;return((e=this.group)==null?void 0:e.data.data)??this._data}set data(e){this._data=e}get _columnNames(){return this.columns.filter(e=>!this.hiddenColumns.includes(e.name)).map(e=>e.name)}get _columnWidths(){return this.columns.filter(e=>!this.hiddenColumns.includes(e.name)).map(e=>e.width)}get _isSelected(){var e;return(e=this.table)==null?void 0:e.selection.has(this.data)}onSelectionChange(e){if(!this.table)return;const i=e.target;this.selected=i.value,i.value?(this.table.selection.add(this.data),this.table.dispatchEvent(new CustomEvent("rowselected",{detail:{data:this.data}}))):(this.table.selection.delete(this.data),this.table.dispatchEvent(new CustomEvent("rowdeselected",{detail:{data:this.data}})))}firstUpdated(e){super.firstUpdated(e),this._observer.observe(this)}connectedCallback(){super.connectedCallback(),this.toggleAttribute("selected",this._isSelected),this.table&&(this.columns=this.table.columns,this.hiddenColumns=this.table.hiddenColumns,this.table.addEventListener("columnschange",this.onTableColumnsChange),this.table.addEventListener("columnshidden",this.onTableColumnsHidden),this.style.gridTemplateAreas=`"${this.table.selectableRows?"Selection":""} ${this._columnNames.join(" ")}"`,this.style.gridTemplateColumns=`${this.table.selectableRows?"1.6rem":""} ${this._columnWidths.join(" ")}`)}disconnectedCallback(){super.disconnectedCallback(),this._observer.unobserve(this),this.columns=[],this.hiddenColumns=[],this.toggleAttribute("selected",!1),this.data={},this.table&&(this.table.removeEventListener("columnschange",this.onTableColumnsChange),this.table.removeEventListener("columnshidden",this.onTableColumnsHidden),this.table=null),this.clean()}applyAdaptativeDataTransform(e){this.addEventListener("pointerenter",()=>{this.dataTransform=e,this._interval=window.setInterval(()=>{this.matches(":hover")||this.clearDataTransform()},50)})}clean(){clearTimeout(this._intersectTimeout),this._intersectTimeout=void 0,this._timeOutDelay=250;for(const[,e]of Object.entries(this._cache))e.remove();this._cache={}}render(){if(!(this.table&&this._intersecting))return C`${ie}`;const e=this.table.getRowIndentation(this.data)??0,i=[];for(const n in this.data){if(this.hiddenColumns.includes(n))continue;const o=document.createElement("bim-table-cell");o.group=this.group,o.table=this.table,o.row=this,o.column=n,this._columnNames.indexOf(n)===0&&(o.style.marginLeft=`${this.table.noIndentation?0:e+.75}rem`);const r=this._columnNames.indexOf(n);o.setAttribute("data-column-index",String(r)),o.toggleAttribute("data-no-indentation",r===0&&this.table.noIndentation),o.toggleAttribute("data-cell-header",this.isHeader),o.rowData=this.data,this.table.dispatchEvent(new CustomEvent("cellcreated",{detail:{cell:o}})),i.push(o)}return this._timeOutDelay=0,C`
      ${!this.isHeader&&this.table.selectableRows?C`<bim-checkbox
            @change=${this.onSelectionChange}
            .checked=${this._isSelected??!1}
            style="align-self: center; justify-self: center"
          ></bim-checkbox>`:null}
      ${i}
      <slot></slot>
    `}};Iu.styles=Q`
    :host {
      position: relative;
      grid-area: Data;
      display: grid;
      min-height: 2.25rem;
      transition: all 0.15s;
    }

    ::slotted(.branch.branch-vertical) {
      top: 50%;
      bottom: 0;
    }

    :host([selected]) {
      background-color: color-mix(
        in lab,
        var(--bim-ui_bg-contrast-20) 30%,
        var(--bim-ui_accent-base) 10%
      );
    }
  `;let Ci=Iu;gn([_({type:Boolean,reflect:!0})],Ci.prototype,"selected");gn([_({attribute:!1})],Ci.prototype,"columns");gn([_({attribute:!1})],Ci.prototype,"hiddenColumns");gn([_({type:Boolean,attribute:"is-header",reflect:!0})],Ci.prototype,"isHeader");gn([Ei()],Ci.prototype,"_intersecting");gn([Ei()],Ci.prototype,"dataTransform");var gg=Object.defineProperty,yg=Object.getOwnPropertyDescriptor,Xe=(t,e,i,n)=>{for(var o=n>1?void 0:n?yg(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&gg(e,i,o),o};const Pu=class extends Z{constructor(){super(...arguments),this._filteredData=[],this.headersHidden=!1,this.minColWidth="4rem",this._columns=[],this._textDelimiters={comma:",",tab:"	"},this._queryString=null,this._data=[],this.expanded=!1,this.preserveStructureOnFilter=!1,this.indentationInText=!1,this.dataTransform={},this.selectableRows=!1,this.selection=new Set,this.noIndentation=!1,this.noCarets=!1,this.loading=!1,this._errorLoading=!1,this._onColumnsHidden=new Event("columnshidden"),this._hiddenColumns=[],this.defaultContentTemplate=e=>C`<bim-label style="white-space: normal; user-select: text;">${e}</bim-label>`,this._stringFilterFunction=(e,i)=>Object.values(i.data).some(n=>String(n).toLowerCase().includes(e.toLowerCase())),this._queryFilterFunction=(e,i)=>{let n=!1;const o=Fs(e)??[];for(const r of o){if("queries"in r){n=!1;break}const{condition:s,value:a}=r;let{key:l}=r;if(l.startsWith("[")&&l.endsWith("]")){const c=l.replace("[","").replace("]","");l=c,n=Object.keys(i.data).filter(d=>d.includes(c)).map(d=>rc(i.data[d],s,a)).some(d=>d)}else n=rc(i.data[l],s,a);if(!n)break}return n}}set columns(e){const i=[];for(const n of e){const o=typeof n=="string"?{name:n,width:`minmax(${this.minColWidth}, 1fr)`}:n;i.push(o)}this._columns=i,this.computeMissingColumns(this.data),this.dispatchEvent(new Event("columnschange"))}get columns(){return this._columns}get _headerRowData(){const e={};for(const i of this.columns){const{name:n}=i;e[n]=String(n)}return e}get value(){return this._filteredData}set queryString(e){this.toggleAttribute("data-processing",!0),this._queryString=e&&e.trim()!==""?e.trim():null,this.updateFilteredData(),this.toggleAttribute("data-processing",!1)}get queryString(){return this._queryString}set data(e){this._data=e,this.updateFilteredData(),this.computeMissingColumns(e)&&(this.columns=this._columns)}get data(){return this._data}get dataAsync(){return new Promise(e=>{setTimeout(()=>{e(this.data)})})}set hiddenColumns(e){this._hiddenColumns=e,setTimeout(()=>{this.dispatchEvent(this._onColumnsHidden)})}get hiddenColumns(){return this._hiddenColumns}updateFilteredData(){this.queryString?(Fs(this.queryString)?(this.filterFunction=this._queryFilterFunction,this._filteredData=this.filter(this.queryString)):(this.filterFunction=this._stringFilterFunction,this._filteredData=this.filter(this.queryString)),this.preserveStructureOnFilter&&(this._expandedBeforeFilter===void 0&&(this._expandedBeforeFilter=this.expanded),this.expanded=!0)):(this.preserveStructureOnFilter&&this._expandedBeforeFilter!==void 0&&(this.expanded=this._expandedBeforeFilter,this._expandedBeforeFilter=void 0),this._filteredData=this.data)}computeMissingColumns(e){let i=!1;for(const n of e){const{children:o,data:r}=n;for(const s in r)this._columns.map(a=>typeof a=="string"?a:a.name).includes(s)||(this._columns.push({name:s,width:`minmax(${this.minColWidth}, 1fr)`}),i=!0);if(o){const s=this.computeMissingColumns(o);s&&!i&&(i=s)}}return i}generateText(e="comma",i=this.value,n="",o=!0){const r=this._textDelimiters[e];let s="";const a=this.columns.map(l=>l.name);if(o){this.indentationInText&&(s+=`Indentation${r}`);const l=`${a.join(r)}
`;s+=l}for(const[l,c]of i.entries()){const{data:d,children:u}=c,h=this.indentationInText?`${n}${l+1}${r}`:"",p=a.map(g=>d[g]??""),m=`${h}${p.join(r)}
`;s+=m,u&&(s+=this.generateText(e,c.children,`${n}${l+1}.`,!1))}return s}get csv(){return this.generateText("comma")}get tsv(){return this.generateText("tab")}applyDataTransform(e){const i={};if(!e)return i;const{data:n}=e.data;for(const r of Object.keys(this.dataTransform)){const s=this.columns.find(a=>a.name===r);s&&s.forceDataTransform&&(r in n||(n[r]=""))}const o=n;for(const r in o){const s=this.dataTransform[r];s?i[r]=s(o[r],n,e):i[r]=n[r]}return i}downloadData(e="BIM Table Data",i="json"){let n=null;if(i==="json"&&(n=new File([JSON.stringify(this.value,void 0,2)],`${e}.json`)),i==="csv"&&(n=new File([this.csv],`${e}.csv`)),i==="tsv"&&(n=new File([this.tsv],`${e}.tsv`)),!n)return;const o=document.createElement("a");o.href=URL.createObjectURL(n),o.download=n.name,o.click(),URL.revokeObjectURL(o.href)}getRowIndentation(e,i=this.value,n=0){for(const o of i){if(o.data===e)return n;if(o.children){const r=this.getRowIndentation(e,o.children,n+1);if(r!==null)return r}}return null}getGroupIndentation(e,i=this.value,n=0){for(const o of i){if(o===e)return n;if(o.children){const r=this.getGroupIndentation(e,o.children,n+1);if(r!==null)return r}}return null}connectedCallback(){super.connectedCallback(),this.dispatchEvent(new Event("connected"))}disconnectedCallback(){super.disconnectedCallback(),this.dispatchEvent(new Event("disconnected"))}async loadData(e=!1){if(this._filteredData.length!==0&&!e||!this.loadFunction)return!1;this.loading=!0;try{const i=await this.loadFunction();return this.data=i,this.loading=!1,this._errorLoading=!1,!0}catch(i){if(this.loading=!1,this._filteredData.length!==0)return!1;const n=this.querySelector("[slot='error-loading']"),o=n?.querySelector("[data-table-element='error-message']");return i instanceof Error&&o&&i.message.trim()!==""&&(o.textContent=i.message),this._errorLoading=!0,!1}}filter(e,i=this.filterFunction??this._stringFilterFunction,n=this.data){const o=[];for(const r of n)if(i(e,r)){if(this.preserveStructureOnFilter){const s={data:r.data};if(r.children){const a=this.filter(e,i,r.children);a.length&&(s.children=a)}o.push(s)}else if(o.push({data:r.data}),r.children){const s=this.filter(e,i,r.children);o.push(...s)}}else if(r.children){const s=this.filter(e,i,r.children);this.preserveStructureOnFilter&&s.length?o.push({data:r.data,children:s}):o.push(...s)}return o}get _missingDataElement(){return this.querySelector("[slot='missing-data']")}render(){if(this.loading)return lg();if(this._errorLoading)return C`<slot name="error-loading"></slot>`;if(this._filteredData.length===0&&this._missingDataElement)return C`<slot name="missing-data"></slot>`;const e=n=>{if(!n)return;const o=n;o.table=this,o.data=this._headerRowData},i=n=>{if(!n)return;const o=n;o.table=this,o.data=this.value,o.requestUpdate()};return C`
      <div class="parent">
        ${cg()}
        ${Fi(!this.headersHidden,()=>C`<bim-table-row is-header style="grid-area: Header; position: sticky; top: 0; z-index: 5" ${mt(e)}></bim-table-row>`)} 
        <div style="overflow-x: hidden; grid-area: Body">
          <bim-table-children ${mt(i)} style="grid-area: Body; background-color: transparent"></bim-table-children>
        </div>
      </div>
    `}};Pu.styles=[Wt.scrollbar,Q`
      :host {
        position: relative;
        overflow: auto;
        display: block;
        pointer-events: auto;
      }

      :host(:not([data-processing])) .loader {
        display: none;
      }

      .parent {
        display: grid;
        grid-template:
          "Header" auto
          "Processing" auto
          "Body" 1fr
          "Footer" auto;
        overflow: auto;
        height: 100%;
      }

      .parent > bim-table-row[is-header] {
        color: var(--bim-table_header--c, var(--bim-ui_bg-contrast-100));
        background-color: var(
          --bim-table_header--bgc,
          var(--bim-ui_bg-contrast-20)
        );
      }

      .controls {
        display: flex;
        gap: 0.375rem;
        flex-wrap: wrap;
        margin-bottom: 0.5rem;
      }
    `];let Fe=Pu;Xe([Ei()],Fe.prototype,"_filteredData",2);Xe([_({type:Boolean,attribute:"headers-hidden",reflect:!0})],Fe.prototype,"headersHidden",2);Xe([_({type:String,attribute:"min-col-width",reflect:!0})],Fe.prototype,"minColWidth",2);Xe([_({type:Array,attribute:!1})],Fe.prototype,"columns",1);Xe([_({type:Array,attribute:!1})],Fe.prototype,"data",1);Xe([_({type:Boolean,reflect:!0})],Fe.prototype,"expanded",2);Xe([_({type:Boolean,reflect:!0,attribute:"selectable-rows"})],Fe.prototype,"selectableRows",2);Xe([_({attribute:!1})],Fe.prototype,"selection",2);Xe([_({type:Boolean,attribute:"no-indentation",reflect:!0})],Fe.prototype,"noIndentation",2);Xe([_({type:Boolean,attribute:"no-carets",reflect:!0})],Fe.prototype,"noCarets",2);Xe([_({type:Boolean,reflect:!0})],Fe.prototype,"loading",2);Xe([Ei()],Fe.prototype,"_errorLoading",2);var vg=Object.defineProperty,wg=Object.getOwnPropertyDescriptor,yn=(t,e,i,n)=>{for(var o=n>1?void 0:n?wg(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&vg(e,i,o),o};const zu=class extends Z{constructor(){super(...arguments),this._switchers=[],this.bottom=!1,this.switchersHidden=!1,this.floating=!1,this.switchersFull=!1,this.onTabHiddenChange=e=>{const i=e.target;i instanceof Ie&&!i.hidden&&(i.removeEventListener("hiddenchange",this.onTabHiddenChange),this.tab=i.name,i.addEventListener("hiddenchange",this.onTabHiddenChange))}}set tab(e){this._tab=e;const i=[...this.children],n=i.find(o=>o instanceof Ie&&o.name===e);for(const o of i){if(!(o instanceof Ie))continue;o.hidden=n!==o;const r=this.getTabSwitcher(o.name);r&&r.toggleAttribute("data-active",!o.hidden)}n||(this._tab="hidden",this.setAttribute("tab","hidden"))}get tab(){return this._tab}getTabSwitcher(e){return this._switchers.find(i=>i.getAttribute("data-name")===e)}createSwitchers(){this._switchers=[];for(const e of this.children){if(!(e instanceof Ie))continue;const i=document.createElement("div");i.addEventListener("click",()=>{this.tab===e.name?this.toggleAttribute("tab",!1):this.tab=e.name,this.setAnimatedBackgound()}),i.setAttribute("data-name",e.name),i.className="switcher";const n=document.createElement("bim-label");n.textContent=e.label??null,n.icon=e.icon,i.append(n),this._switchers.push(i)}}updateSwitchers(){for(const e of this.children){if(!(e instanceof Ie))continue;const i=this._switchers.find(o=>o.getAttribute("data-name")===e.name);if(!i)continue;const n=i.querySelector("bim-label");n&&(n.textContent=e.label??null,n.icon=e.icon)}}onSlotChange(e){this.createSwitchers();const i=e.target.assignedElements(),n=i.find(o=>o instanceof Ie?this.tab?o.name===this.tab:!o.hidden:!1);n&&n instanceof Ie&&(this.tab=n.name);for(const o of i){if(!(o instanceof Ie)){o.remove();continue}o.removeEventListener("hiddenchange",this.onTabHiddenChange),n!==o&&(o.hidden=!0),o.addEventListener("hiddenchange",this.onTabHiddenChange)}}doubleRequestAnimationFrames(e){requestAnimationFrame(()=>requestAnimationFrame(e))}setAnimatedBackgound(e=!1){var i;const n=this.renderRoot.querySelector(".animated-background"),o=[...((i=this.renderRoot.querySelector(".switchers"))==null?void 0:i.querySelectorAll(".switcher"))||[]].filter(r=>r.hasAttribute("data-active"))[0];requestAnimationFrame(()=>{var r,s,a,l;const c=(l=(a=(s=(r=o?.parentElement)==null?void 0:r.shadowRoot)==null?void 0:s.querySelector("bim-input"))==null?void 0:a.shadowRoot)==null?void 0:l.querySelector(".input"),d={width:o?.clientWidth,height:o?.clientHeight,top:(o?.offsetTop??0)-(c?.offsetTop??0),left:(o?.offsetLeft??0)-(c?.offsetLeft??0)};o?(n?.style.setProperty("width",`${d.width}px`),n?.style.setProperty("height",`${d.height}px`),n?.style.setProperty("left",`${d.left}px`)):n?.style.setProperty("width","0"),this.bottom?(n?.style.setProperty("top","100%"),n?.style.setProperty("transform","translateY(-100%)")):n?.style.setProperty("top",`${d.top}px`)}),e&&this.doubleRequestAnimationFrames(()=>{const r="ease";n?.style.setProperty("transition",`width ${.3}s ${r}, height ${.3}s ${r}, top ${.3}s ${r}, left ${.3}s ${r}`)})}firstUpdated(){requestAnimationFrame(()=>{this.setAnimatedBackgound(!0)}),new ResizeObserver(()=>{this.setAnimatedBackgound()}).observe(this)}render(){return C`
      <div class="parent">
        <div class="switchers">
          <div class="animated-background"></div>
          ${this._switchers}
        </div>
        <div class="content">
          <slot @slotchange=${this.onSlotChange}></slot>
        </div>
      </div>
    `}};zu.styles=[Wt.scrollbar,Q`
      * {
        box-sizing: border-box;
      }

      :host {
        background-color: var(--bim-ui_bg-base);
        display: block;
        overflow: auto;
      }

      .parent {
        display: grid;
        overflow: hidden;
        position: relative;
        grid-template: "switchers" auto "content" 1fr;
        height: 100%;
      }

      :host([bottom]) .parent {
        grid-template: "content" 1fr "switchers" auto;
      }

      .switchers {
        position: relative;
        display: flex;
        height: 2.25rem;
        font-weight: 600;
        grid-area: switchers;
      }

      .switcher {
        --bim-label--c: var(--bim-ui_bg-contrast-80);
        background-color: transparent;
        position: relative;
        cursor: pointer;
        pointer-events: auto;
        padding: 0rem 0.75rem;
        display: flex;
        justify-content: center;
        z-index: 2;
        transition: all 0.15s;
      }

      .switcher:not([data-active]):hover {
        filter: brightness(150%);
      }

      :host([switchers-full]) .switcher {
        flex: 1;
      }

      .switcher[data-active] {
        --bim-label--c: var(--bim-ui_main-contrast);
      }

      .switchers bim-label {
        pointer-events: none;
      }

      :host([switchers-hidden]) .switchers {
        display: none;
      }

      .content {
        position: relative;
        display: grid;
        grid-template-columns: 1fr;
        grid-area: content;
        max-height: 100vh;
        overflow: auto;
        transition: max-height 0.2s;
      }

      :host([tab="hidden"]) .content {
        max-height: 0;
      }

      .animated-background {
        position: absolute;
        background: var(--bim-ui_main-base);
        width: 0;
        height: 0;
        top: 0;
        left: 0;
      }

      :host(:not([bottom])) .content {
        border-top: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([bottom]) .content {
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating]) {
        background-color: transparent;
      }

      :host([floating]) .switchers {
        justify-self: center;
        overflow: hidden;
        background-color: var(--bim-ui_bg-base);
      }

      :host([floating]:not([bottom])) .switchers {
        border-radius: var(--bim-ui_size-2xs) var(--bim-ui_size-2xs) 0 0;
        border-top: 1px solid var(--bim-ui_bg-contrast-20);
        border-left: 1px solid var(--bim-ui_bg-contrast-20);
        border-right: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating][bottom]) .switchers {
        border-radius: 0 0 var(--bim-ui_size-2xs) var(--bim-ui_size-2xs);
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
        border-left: 1px solid var(--bim-ui_bg-contrast-20);
        border-right: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating][tab="hidden"]) .switchers {
        border-radius: var(--bim-ui_size-2xs);
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating][bottom][tab="hidden"]) .switchers {
        border-top: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating]) .content {
        border: 1px solid var(--bim-ui_bg-contrast-20);
        border-radius: var(--bim-ui_size-2xs);
        background-color: var(--bim-ui_bg-base);
      }
    `];let Tt=zu;yn([Ei()],Tt.prototype,"_switchers",2);yn([_({type:Boolean,reflect:!0})],Tt.prototype,"bottom",2);yn([_({type:Boolean,attribute:"switchers-hidden",reflect:!0})],Tt.prototype,"switchersHidden",2);yn([_({type:Boolean,reflect:!0})],Tt.prototype,"floating",2);yn([_({type:String,reflect:!0})],Tt.prototype,"tab",1);yn([_({type:Boolean,attribute:"switchers-full",reflect:!0})],Tt.prototype,"switchersFull",2);var $g=Object.defineProperty,_g=Object.getOwnPropertyDescriptor,Rr=(t,e,i,n)=>{for(var o=n>1?void 0:n?_g(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&$g(e,i,o),o};const Lu=class extends Z{constructor(){super(...arguments),this._defaultName="__unnamed__",this.name=this._defaultName,this._hidden=!1}set label(e){this._label=e;const i=this.parentElement;i instanceof Tt&&i.updateSwitchers()}get label(){return this._label}set icon(e){this._icon=e;const i=this.parentElement;i instanceof Tt&&i.updateSwitchers()}get icon(){return this._icon}set hidden(e){this._hidden=e,this.dispatchEvent(new Event("hiddenchange"))}get hidden(){return this._hidden}connectedCallback(){super.connectedCallback();const{parentElement:e}=this;if(e&&this.name===this._defaultName){const i=[...e.children].indexOf(this);this.name=`${this._defaultName}${i}`}}render(){return C` <slot></slot> `}};Lu.styles=Q`
    :host {
      display: block;
      height: 100%;
      grid-row-start: 1;
      grid-column-start: 1;
      animation: openAnim 3s forwards;
      transform: translateY(0);
      max-height: 100vh;
      transition:
        opacity 0.3s ease,
        max-height 0.6s ease,
        transform 0.3s ease;
    }

    :host([hidden]) {
      transform: translateY(-20px);
      max-height: 0;
      opacity: 0;
      overflow: hidden;
      visibility: hidden;
    }
  `;let Ie=Lu;Rr([_({type:String,reflect:!0})],Ie.prototype,"name",2);Rr([_({type:String,reflect:!0})],Ie.prototype,"label",1);Rr([_({type:String,reflect:!0})],Ie.prototype,"icon",1);Rr([_({type:Boolean,reflect:!0})],Ie.prototype,"hidden",1);var xg=Object.defineProperty,Eg=Object.getOwnPropertyDescriptor,st=(t,e,i,n)=>{for(var o=n>1?void 0:n?Eg(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&xg(e,i,o),o};const Mu=class extends Z{constructor(){super(...arguments),this._inputTypes=["date","datetime-local","email","month","password","search","tel","text","time","url","week","area"],this.value="",this.vertical=!1,this.disabled=!1,this.resize="vertical",this._type="text",this.onValueChange=new Event("input")}set type(e){this._inputTypes.includes(e)&&(this._type=e)}get type(){return this._type}get query(){return Fs(this.value)}onInputChange(e){e.stopPropagation();const i=e.target;clearTimeout(this._debounceTimeoutID),this._debounceTimeoutID=setTimeout(()=>{this.value=i.value,this.dispatchEvent(this.onValueChange)},this.debounce)}focus(){setTimeout(()=>{var e;const i=(e=this.shadowRoot)==null?void 0:e.querySelector("input");i?.focus()})}render(){return C`
      <bim-input
        .name=${this.name}
        .icon=${this.icon}
        .label=${this.label}
        .vertical=${this.vertical}
      >
        ${this.type==="area"?C` <textarea
              aria-label=${this.label||this.name||"Text Input"}
              .value=${this.value}
              .rows=${this.rows??5}
              ?disabled=${this.disabled}
              placeholder=${Hs(this.placeholder)}
              @input=${this.onInputChange}
              style="resize: ${this.resize};"
            ></textarea>`:C` <input
              aria-label=${this.label||this.name||"Text Input"}
              .type=${this.type}
              .value=${this.value}
              ?disabled=${this.disabled}
              placeholder=${Hs(this.placeholder)}
              @input=${this.onInputChange}
            />`}
      </bim-input>
    `}};Mu.styles=[Wt.scrollbar,Q`
      :host {
        --bim-input--bgc: var(--bim-ui_bg-contrast-20);
        flex: 1;
        display: block;
      }

      input,
      textarea {
        font-family: inherit;
        background-color: transparent;
        border: none;
        width: 100%;
        padding: var(--bim-ui_size-3xs);
        color: var(--bim-text-input--c, var(--bim-ui_bg-contrast-100));
      }

      input {
        outline: none;
        height: 100%;
        padding: 0 var(--bim-ui_size-3xs); /* Override padding */
        border-radius: var(--bim-text-input--bdrs, var(--bim-ui_size-4xs));
      }

      :host([disabled]) input,
      :host([disabled]) textarea {
        color: var(--bim-ui_bg-contrast-60);
      }

      textarea {
        line-height: 1.1rem;
        outline: none;
      }

      :host(:focus) {
        --bim-input--olc: var(--bim-ui_accent-base);
      }

      /* :host([disabled]) {
      --bim-input--bgc: var(--bim-ui_bg-contrast-20);
    } */
    `];let Ze=Mu;st([_({type:String,reflect:!0})],Ze.prototype,"icon",2);st([_({type:String,reflect:!0})],Ze.prototype,"label",2);st([_({type:String,reflect:!0})],Ze.prototype,"name",2);st([_({type:String,reflect:!0})],Ze.prototype,"placeholder",2);st([_({type:String,reflect:!0})],Ze.prototype,"value",2);st([_({type:Boolean,reflect:!0})],Ze.prototype,"vertical",2);st([_({type:Number,reflect:!0})],Ze.prototype,"debounce",2);st([_({type:Number,reflect:!0})],Ze.prototype,"rows",2);st([_({type:Boolean,reflect:!0})],Ze.prototype,"disabled",2);st([_({type:String,reflect:!0})],Ze.prototype,"resize",2);st([_({type:String,reflect:!0})],Ze.prototype,"type",1);var Sg=Object.defineProperty,Ag=Object.getOwnPropertyDescriptor,Du=(t,e,i,n)=>{for(var o=n>1?void 0:n?Ag(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&Sg(e,i,o),o};const ju=class extends Z{constructor(){super(...arguments),this.rows=2,this._vertical=!1}set vertical(e){this._vertical=e,this.updateChildren()}get vertical(){return this._vertical}updateChildren(){const e=this.children;for(const i of e)this.vertical?i.setAttribute("label-hidden",""):i.removeAttribute("label-hidden")}render(){return C`
      <style>
        .parent {
          grid-auto-flow: ${this.vertical?"row":"column"};
          grid-template-rows: repeat(${this.rows}, 1fr);
        }
      </style>
      <div class="parent">
        <slot @slotchange=${this.updateChildren}></slot>
      </div>
    `}};ju.styles=Q`
    .parent {
      display: grid;
      gap: 0.25rem;
    }

    ::slotted(bim-button[label]:not([vertical])) {
      --bim-button--jc: flex-start;
    }

    ::slotted(bim-button) {
      --bim-label--c: var(--bim-ui_bg-contrast-80);
    }
  `;let Br=ju;Du([_({type:Number,reflect:!0})],Br.prototype,"rows",2);Du([_({type:Boolean,reflect:!0})],Br.prototype,"vertical",1);var Cg=Object.defineProperty,kg=Object.getOwnPropertyDescriptor,Nr=(t,e,i,n)=>{for(var o=n>1?void 0:n?kg(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&Cg(e,i,o),o};const Ru=class extends Z{constructor(){super(...arguments),this._vertical=!1,this._labelHidden=!1}set vertical(e){this._vertical=e,this.updateChildren()}get vertical(){return this._vertical}set labelHidden(e){this._labelHidden=e,this.updateChildren()}get labelHidden(){return this._labelHidden}updateChildren(){const e=this.children;for(const i of e)i instanceof Br&&(i.vertical=this.vertical),i.toggleAttribute("label-hidden",this.vertical)}render(){return C`
      <div class="parent">
        <div class="children">
          <slot @slotchange=${this.updateChildren}></slot>
        </div>
        ${!this.labelHidden&&(this.label||this.icon)?C`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
      </div>
    `}};Ru.styles=Q`
    :host {
      --bim-label--fz: var(--bim-ui_size-xs);
      --bim-label--c: var(--bim-ui_bg-contrast-60);
      display: block;
      flex: 1;
    }

    :host(:not([vertical])) ::slotted(bim-button[vertical]) {
      --bim-icon--fz: var(--bim-ui_size-5xl);
      min-height: 3.75rem;
    }

    .parent {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      align-items: center;
      padding: 0.5rem;
      height: 100%;
      box-sizing: border-box;
      justify-content: space-between;
    }

    :host([vertical]) .parent {
      flex-direction: row-reverse;
    }

    :host([vertical]) .parent > bim-label {
      writing-mode: tb;
    }

    .children {
      display: flex;
      gap: 0.25rem;
    }

    :host([vertical]) .children {
      flex-direction: column;
    }
  `;let vn=Ru;Nr([_({type:String,reflect:!0})],vn.prototype,"label",2);Nr([_({type:String,reflect:!0})],vn.prototype,"icon",2);Nr([_({type:Boolean,reflect:!0})],vn.prototype,"vertical",1);Nr([_({type:Boolean,attribute:"label-hidden",reflect:!0})],vn.prototype,"labelHidden",1);var Tg=Object.defineProperty,Og=Object.getOwnPropertyDescriptor,Ma=(t,e,i,n)=>{for(var o=n>1?void 0:n?Og(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&Tg(e,i,o),o};const Bu=class extends Z{constructor(){super(...arguments),this.labelsHidden=!1,this._vertical=!1,this._hidden=!1}set vertical(e){this._vertical=e,this.updateSections()}get vertical(){return this._vertical}set hidden(e){this._hidden=e,this.dispatchEvent(new Event("hiddenchange"))}get hidden(){return this._hidden}updateSections(){const e=this.children;for(const i of e)i instanceof vn&&(i.labelHidden=this.vertical&&!Mr.config.sectionLabelOnVerticalToolbar,i.vertical=this.vertical)}render(){return C`
      <div class="parent">
        <slot @slotchange=${this.updateSections}></slot>
      </div>
    `}};Bu.styles=Q`
    :host {
      --bim-button--bgc: transparent;
      background-color: var(--bim-ui_bg-base);
      border-radius: var(--bim-ui_size-2xs);
      display: block;
    }

    :host([hidden]) {
      display: none;
    }

    .parent {
      display: flex;
      width: max-content;
      pointer-events: auto;
    }

    :host([vertical]) .parent {
      flex-direction: column;
    }

    :host([vertical]) {
      width: min-content;
      border-radius: var(--bim-ui_size-2xs);
      border: 1px solid var(--bim-ui_bg-contrast-20);
    }

    ::slotted(bim-toolbar-section:not(:last-child)) {
      border-right: 1px solid var(--bim-ui_bg-contrast-20);
      border-bottom: none;
    }

    :host([vertical]) ::slotted(bim-toolbar-section:not(:last-child)) {
      border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      border-right: none;
    }
  `;let Fr=Bu;Ma([_({type:String,reflect:!0})],Fr.prototype,"icon",2);Ma([_({type:Boolean,attribute:"labels-hidden",reflect:!0})],Fr.prototype,"labelsHidden",2);Ma([_({type:Boolean,reflect:!0})],Fr.prototype,"vertical",1);var Ig=Object.defineProperty,Pg=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&Ig(e,i,o),o};const Nu=class extends Z{constructor(){super(),this._onResize=new Event("resize"),new ResizeObserver(()=>{setTimeout(()=>{this.dispatchEvent(this._onResize)})}).observe(this)}render(){return C`
      <div class="parent">
        <slot></slot>
      </div>
    `}};Nu.styles=Q`
    :host {
      display: grid;
      min-width: 0;
      min-height: 0;
      height: 100%;
    }

    .parent {
      overflow: hidden;
      position: relative;
    }
  `;let Fu=Nu;Pg([_({type:String,reflect:!0})],Fu.prototype,"name");var zg=Object.defineProperty,Da=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&zg(e,i,o),o},_e;const Ur=(_e=class extends Z{constructor(){super(...arguments),this.visible=!1,this._previousContainer=null,this._showToolTip=async()=>{this.timeoutId=setTimeout(async()=>{if(this.visible=!0,!_e.container.parentElement){const t=document.querySelector("[data-context-dialog]");t?t.append(_e.container):document.body.append(_e.container)}this._previousContainer=this.parentElement,_e.container.style.top=`${window.scrollY||document.documentElement.scrollTop}px`,_e.container.append(this),await this.computePosition()},this.timeout===void 0?800:this.timeout)},this._hideToolTip=()=>{clearTimeout(this.timeoutId),this.visible=!1,this._previousContainer&&(this._previousContainer.append(this),this._previousContainer=null),_e.container.children.length===0&&_e.container.parentElement&&_e.container.remove()}}static get container(){return _e._container||(_e._container=document.createElement("div"),_e._container.style.cssText=`
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        overflow: visible;
        pointer-events: none;
        z-index: 9999;
      `),_e._container}async computePosition(){const t=this._previousContainer||this.parentElement;if(!t)return;const e=this.style.display;this.style.display="block",this.style.visibility="hidden",await new Promise(requestAnimationFrame);const{x:i,y:n}=await $a(t,this,{placement:this.placement,middleware:[ma(10),va(),ya({padding:8}),wa()]});Object.assign(this.style,{left:`${i}px`,top:`${n}px`,display:e,visibility:""})}connectedCallback(){super.connectedCallback();const t=this.parentElement;t&&(t.addEventListener("mouseenter",this._showToolTip),t.addEventListener("mouseleave",this._hideToolTip))}disconnectedCallback(){super.disconnectedCallback();const t=this.parentElement;t&&(t.removeEventListener("mouseenter",this._showToolTip),t.removeEventListener("mouseleave",this._hideToolTip))}render(){return C`<div><slot></slot></div>`}},_e.styles=Q`
    :host {
      position: absolute;
      background: var(--bim-ui_bg-contrast-20, #fff);
      color: var(--bim-ui_bg-contrast-100, #000);
      border-radius: var(--bim-ui_size-4xs, 4px);
      box-shadow: 0 0 10px 3px rgba(0, 0, 0, 0.2);
      padding: 0.75rem;
      font-size: var(--bim-ui_size-xs, 0.875rem);
      display: none;
    }
    :host([visible]) {
      display: flex;
    }
  `,_e._container=null,_e);Da([_({type:Boolean,reflect:!0})],Ur.prototype,"visible");Da([_({type:Number,reflect:!0})],Ur.prototype,"timeout");Da([_({type:String,reflect:!0})],Ur.prototype,"placement");let Lg=Ur;/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const qo=globalThis,ja=qo.ShadowRoot&&(qo.ShadyCSS===void 0||qo.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Ra=Symbol(),ac=new WeakMap;let Uu=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==Ra)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(ja&&t===void 0){const i=e!==void 0&&e.length===1;i&&(t=ac.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&ac.set(e,t))}return t}toString(){return this.cssText}};const Mg=t=>new Uu(typeof t=="string"?t:t+"",void 0,Ra),Ba=(t,...e)=>{const i=t.length===1?t[0]:e.reduce((n,o,r)=>n+(s=>{if(s._$cssResult$===!0)return s.cssText;if(typeof s=="number")return s;throw Error("Value passed to 'css' function must be a 'css' function result: "+s+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(o)+t[r+1],t[0]);return new Uu(i,t,Ra)},Dg=(t,e)=>{if(ja)t.adoptedStyleSheets=e.map(i=>i instanceof CSSStyleSheet?i:i.styleSheet);else for(const i of e){const n=document.createElement("style"),o=qo.litNonce;o!==void 0&&n.setAttribute("nonce",o),n.textContent=i.cssText,t.appendChild(n)}},lc=ja?t=>t:t=>t instanceof CSSStyleSheet?(e=>{let i="";for(const n of e.cssRules)i+=n.cssText;return Mg(i)})(t):t;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:jg,defineProperty:Rg,getOwnPropertyDescriptor:Bg,getOwnPropertyNames:Ng,getOwnPropertySymbols:Fg,getPrototypeOf:Ug}=Object,en=globalThis,cc=en.trustedTypes,Hg=cc?cc.emptyScript:"",dc=en.reactiveElementPolyfillSupport,Dn=(t,e)=>t,sr={toAttribute(t,e){switch(e){case Boolean:t=t?Hg:null;break;case Object:case Array:t=t==null?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=t!==null;break;case Number:i=t===null?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch{i=null}}return i}},Na=(t,e)=>!jg(t,e),uc={attribute:!0,type:String,converter:sr,reflect:!1,useDefault:!1,hasChanged:Na};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),en.litPropertyMetadata??(en.litPropertyMetadata=new WeakMap);let Mi=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=uc){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),n=this.getPropertyDescriptor(t,i,e);n!==void 0&&Rg(this.prototype,t,n)}}static getPropertyDescriptor(t,e,i){const{get:n,set:o}=Bg(this.prototype,t)??{get(){return this[e]},set(r){this[e]=r}};return{get:n,set(r){const s=n?.call(this);o?.call(this,r),this.requestUpdate(t,s,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??uc}static _$Ei(){if(this.hasOwnProperty(Dn("elementProperties")))return;const t=Ug(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(Dn("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Dn("properties"))){const e=this.properties,i=[...Ng(e),...Fg(e)];for(const n of i)this.createProperty(n,e[n])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[i,n]of e)this.elementProperties.set(i,n)}this._$Eh=new Map;for(const[e,i]of this.elementProperties){const n=this._$Eu(e,i);n!==void 0&&this._$Eh.set(n,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const n of i)e.unshift(lc(n))}else t!==void 0&&e.push(lc(t));return e}static _$Eu(t,e){const i=e.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(e=>e(this))}addController(t){var e;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((e=t.hostConnected)==null||e.call(t))}removeController(t){var e;(e=this._$EO)==null||e.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Dg(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(e=>{var i;return(i=e.hostConnected)==null?void 0:i.call(e)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(e=>{var i;return(i=e.hostDisconnected)==null?void 0:i.call(e)})}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){var i;const n=this.constructor.elementProperties.get(t),o=this.constructor._$Eu(t,n);if(o!==void 0&&n.reflect===!0){const r=(((i=n.converter)==null?void 0:i.toAttribute)!==void 0?n.converter:sr).toAttribute(e,n.type);this._$Em=t,r==null?this.removeAttribute(o):this.setAttribute(o,r),this._$Em=null}}_$AK(t,e){var i,n;const o=this.constructor,r=o._$Eh.get(t);if(r!==void 0&&this._$Em!==r){const s=o.getPropertyOptions(r),a=typeof s.converter=="function"?{fromAttribute:s.converter}:((i=s.converter)==null?void 0:i.fromAttribute)!==void 0?s.converter:sr;this._$Em=r;const l=a.fromAttribute(e,s.type);this[r]=l??((n=this._$Ej)==null?void 0:n.get(r))??l,this._$Em=null}}requestUpdate(t,e,i,n=!1,o){var r;if(t!==void 0){const s=this.constructor;if(n===!1&&(o=this[t]),i??(i=s.getPropertyOptions(t)),!((i.hasChanged??Na)(o,e)||i.useDefault&&i.reflect&&o===((r=this._$Ej)==null?void 0:r.get(t))&&!this.hasAttribute(s._$Eu(t,i))))return;this.C(t,e,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:n,wrapped:o},r){i&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,r??e??this[t]),o!==!0||r!==void 0)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),n===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var t;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[o,r]of this._$Ep)this[o]=r;this._$Ep=void 0}const n=this.constructor.elementProperties;if(n.size>0)for(const[o,r]of n){const{wrapped:s}=r,a=this[o];s!==!0||this._$AL.has(o)||a===void 0||this.C(o,void 0,r,a)}}let e=!1;const i=this._$AL;try{e=this.shouldUpdate(i),e?(this.willUpdate(i),(t=this._$EO)==null||t.forEach(n=>{var o;return(o=n.hostUpdate)==null?void 0:o.call(n)}),this.update(i)):this._$EM()}catch(n){throw e=!1,this._$EM(),n}e&&this._$AE(i)}willUpdate(t){}_$AE(t){var e;(e=this._$EO)==null||e.forEach(i=>{var n;return(n=i.hostUpdated)==null?void 0:n.call(i)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(e=>this._$ET(e,this[e]))),this._$EM()}updated(t){}firstUpdated(t){}};Mi.elementStyles=[],Mi.shadowRootOptions={mode:"open"},Mi[Dn("elementProperties")]=new Map,Mi[Dn("finalized")]=new Map,dc?.({ReactiveElement:Mi}),(en.reactiveElementVersions??(en.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ar=globalThis,hc=t=>t,lr=ar.trustedTypes,pc=lr?lr.createPolicy("lit-html",{createHTML:t=>t}):void 0,Hu="$lit$",Dt=`lit$${Math.random().toFixed(9).slice(2)}$`,qu="?"+Dt,qg=`<${qu}>`,$i=document,Zn=()=>$i.createComment(""),Jn=t=>t===null||typeof t!="object"&&typeof t!="function",Fa=Array.isArray,Vg=t=>Fa(t)||typeof t?.[Symbol.iterator]=="function",ps=`[ 	
\f\r]`,Tn=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,fc=/-->/g,mc=/>/g,ri=RegExp(`>|${ps}(?:([^\\s"'>=/]+)(${ps}*=${ps}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),bc=/'/g,gc=/"/g,Vu=/^(?:script|style|textarea|title)$/i,Gg=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),Ua=Gg(1),tn=Symbol.for("lit-noChange"),pe=Symbol.for("lit-nothing"),yc=new WeakMap,di=$i.createTreeWalker($i,129);function Gu(t,e){if(!Fa(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return pc!==void 0?pc.createHTML(e):e}const Wg=(t,e)=>{const i=t.length-1,n=[];let o,r=e===2?"<svg>":e===3?"<math>":"",s=Tn;for(let a=0;a<i;a++){const l=t[a];let c,d,u=-1,h=0;for(;h<l.length&&(s.lastIndex=h,d=s.exec(l),d!==null);)h=s.lastIndex,s===Tn?d[1]==="!--"?s=fc:d[1]!==void 0?s=mc:d[2]!==void 0?(Vu.test(d[2])&&(o=RegExp("</"+d[2],"g")),s=ri):d[3]!==void 0&&(s=ri):s===ri?d[0]===">"?(s=o??Tn,u=-1):d[1]===void 0?u=-2:(u=s.lastIndex-d[2].length,c=d[1],s=d[3]===void 0?ri:d[3]==='"'?gc:bc):s===gc||s===bc?s=ri:s===fc||s===mc?s=Tn:(s=ri,o=void 0);const p=s===ri&&t[a+1].startsWith("/>")?" ":"";r+=s===Tn?l+qg:u>=0?(n.push(c),l.slice(0,u)+Hu+l.slice(u)+Dt+p):l+Dt+(u===-2?a:p)}return[Gu(t,r+(t[i]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),n]};let qs=class Wu{constructor({strings:e,_$litType$:i},n){let o;this.parts=[];let r=0,s=0;const a=e.length-1,l=this.parts,[c,d]=Wg(e,i);if(this.el=Wu.createElement(c,n),di.currentNode=this.el.content,i===2||i===3){const u=this.el.content.firstChild;u.replaceWith(...u.childNodes)}for(;(o=di.nextNode())!==null&&l.length<a;){if(o.nodeType===1){if(o.hasAttributes())for(const u of o.getAttributeNames())if(u.endsWith(Hu)){const h=d[s++],p=o.getAttribute(u).split(Dt),m=/([.?@])?(.*)/.exec(h);l.push({type:1,index:r,name:m[2],strings:p,ctor:m[1]==="."?Xg:m[1]==="?"?Zg:m[1]==="@"?Jg:Hr}),o.removeAttribute(u)}else u.startsWith(Dt)&&(l.push({type:6,index:r}),o.removeAttribute(u));if(Vu.test(o.tagName)){const u=o.textContent.split(Dt),h=u.length-1;if(h>0){o.textContent=lr?lr.emptyScript:"";for(let p=0;p<h;p++)o.append(u[p],Zn()),di.nextNode(),l.push({type:2,index:++r});o.append(u[h],Zn())}}}else if(o.nodeType===8)if(o.data===qu)l.push({type:2,index:r});else{let u=-1;for(;(u=o.data.indexOf(Dt,u+1))!==-1;)l.push({type:7,index:r}),u+=Dt.length-1}r++}}static createElement(e,i){const n=$i.createElement("template");return n.innerHTML=e,n}};function nn(t,e,i=t,n){var o,r;if(e===tn)return e;let s=n!==void 0?(o=i._$Co)==null?void 0:o[n]:i._$Cl;const a=Jn(e)?void 0:e._$litDirective$;return s?.constructor!==a&&((r=s?._$AO)==null||r.call(s,!1),a===void 0?s=void 0:(s=new a(t),s._$AT(t,i,n)),n!==void 0?(i._$Co??(i._$Co=[]))[n]=s:i._$Cl=s),s!==void 0&&(e=nn(t,s._$AS(t,e.values),s,n)),e}let Yg=class{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,n=(t?.creationScope??$i).importNode(e,!0);di.currentNode=n;let o=di.nextNode(),r=0,s=0,a=i[0];for(;a!==void 0;){if(r===a.index){let l;a.type===2?l=new $o(o,o.nextSibling,this,t):a.type===1?l=new a.ctor(o,a.name,a.strings,this,t):a.type===6&&(l=new Kg(o,this,t)),this._$AV.push(l),a=i[++s]}r!==a?.index&&(o=di.nextNode(),r++)}return di.currentNode=$i,n}p(t){let e=0;for(const i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}};class $o{get _$AU(){var e;return((e=this._$AM)==null?void 0:e._$AU)??this._$Cv}constructor(e,i,n,o){this.type=2,this._$AH=pe,this._$AN=void 0,this._$AA=e,this._$AB=i,this._$AM=n,this.options=o,this._$Cv=o?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const i=this._$AM;return i!==void 0&&e?.nodeType===11&&(e=i.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,i=this){e=nn(this,e,i),Jn(e)?e===pe||e==null||e===""?(this._$AH!==pe&&this._$AR(),this._$AH=pe):e!==this._$AH&&e!==tn&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):Vg(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==pe&&Jn(this._$AH)?this._$AA.nextSibling.data=e:this.T($i.createTextNode(e)),this._$AH=e}$(e){var i;const{values:n,_$litType$:o}=e,r=typeof o=="number"?this._$AC(e):(o.el===void 0&&(o.el=qs.createElement(Gu(o.h,o.h[0]),this.options)),o);if(((i=this._$AH)==null?void 0:i._$AD)===r)this._$AH.p(n);else{const s=new Yg(r,this),a=s.u(this.options);s.p(n),this.T(a),this._$AH=s}}_$AC(e){let i=yc.get(e.strings);return i===void 0&&yc.set(e.strings,i=new qs(e)),i}k(e){Fa(this._$AH)||(this._$AH=[],this._$AR());const i=this._$AH;let n,o=0;for(const r of e)o===i.length?i.push(n=new $o(this.O(Zn()),this.O(Zn()),this,this.options)):n=i[o],n._$AI(r),o++;o<i.length&&(this._$AR(n&&n._$AB.nextSibling,o),i.length=o)}_$AR(e=this._$AA.nextSibling,i){var n;for((n=this._$AP)==null?void 0:n.call(this,!1,!0,i);e!==this._$AB;){const o=hc(e).nextSibling;hc(e).remove(),e=o}}setConnected(e){var i;this._$AM===void 0&&(this._$Cv=e,(i=this._$AP)==null||i.call(this,e))}}let Hr=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,n,o){this.type=1,this._$AH=pe,this._$AN=void 0,this.element=t,this.name=e,this._$AM=n,this.options=o,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=pe}_$AI(t,e=this,i,n){const o=this.strings;let r=!1;if(o===void 0)t=nn(this,t,e,0),r=!Jn(t)||t!==this._$AH&&t!==tn,r&&(this._$AH=t);else{const s=t;let a,l;for(t=o[0],a=0;a<o.length-1;a++)l=nn(this,s[i+a],e,a),l===tn&&(l=this._$AH[a]),r||(r=!Jn(l)||l!==this._$AH[a]),l===pe?t=pe:t!==pe&&(t+=(l??"")+o[a+1]),this._$AH[a]=l}r&&!n&&this.j(t)}j(t){t===pe?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},Xg=class extends Hr{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===pe?void 0:t}};class Zg extends Hr{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==pe)}}let Jg=class extends Hr{constructor(t,e,i,n,o){super(t,e,i,n,o),this.type=5}_$AI(t,e=this){if((t=nn(this,t,e,0)??pe)===tn)return;const i=this._$AH,n=t===pe&&i!==pe||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,o=t!==pe&&(i===pe||n);n&&this.element.removeEventListener(this.name,this,i),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var e;typeof this._$AH=="function"?this._$AH.call(((e=this.options)==null?void 0:e.host)??this.element,t):this._$AH.handleEvent(t)}},Kg=class{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){nn(this,t)}};const vc=ar.litHtmlPolyfillSupport;vc?.(qs,$o),(ar.litHtmlVersions??(ar.litHtmlVersions=[])).push("3.3.2");const Qg=(t,e,i)=>{const n=i?.renderBefore??e;let o=n._$litPart$;if(o===void 0){const r=i?.renderBefore??null;n._$litPart$=o=new $o(e.insertBefore(Zn(),r),r,void 0,i??{})}return o._$AI(t),o};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Kn=globalThis;let fi=class extends Mi{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var t;const e=super.createRenderRoot();return(t=this.renderOptions).renderBefore??(t.renderBefore=e.firstChild),e}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Qg(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return tn}};var wc;fi._$litElement$=!0,fi.finalized=!0,(wc=Kn.litElementHydrateSupport)==null||wc.call(Kn,{LitElement:fi});const $c=Kn.litElementPolyfillSupport;$c?.({LitElement:fi});(Kn.litElementVersions??(Kn.litElementVersions=[])).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ey={attribute:!0,type:String,converter:sr,reflect:!1,hasChanged:Na},ty=(t=ey,e,i)=>{const{kind:n,metadata:o}=i;let r=globalThis.litPropertyMetadata.get(o);if(r===void 0&&globalThis.litPropertyMetadata.set(o,r=new Map),n==="setter"&&((t=Object.create(t)).wrapped=!0),r.set(i.name,t),n==="accessor"){const{name:s}=i;return{set(a){const l=e.get.call(this);e.set.call(this,a),this.requestUpdate(s,l,t,!0,a)},init(a){return a!==void 0&&this.C(s,void 0,t,a),a}}}if(n==="setter"){const{name:s}=i;return function(a){const l=this[s];e.call(this,a),this.requestUpdate(s,l,t,!0,a)}}throw Error("Unsupported decorator location: "+n)};function Te(t){return(e,i)=>typeof i=="object"?ty(t,e,i):((n,o,r)=>{const s=o.hasOwnProperty(r);return o.constructor.createProperty(r,n),s?Object.getOwnPropertyDescriptor(o,r):void 0})(t,e,i)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function iy(t){return Te({...t,state:!0,attribute:!1})}class ny extends tf{constructor(e=document.createElement("div")){super(),this.isCSS2DObject=!0,this.element=e,this.element.style.position="absolute",this.element.style.userSelect="none",this.element.setAttribute("draggable",!1),this.center=new xr(.5,.5),this.addEventListener("removed",function(){this.traverse(function(i){i.element instanceof i.element.ownerDocument.defaultView.Element&&i.element.parentNode!==null&&i.element.remove()})})}copy(e,i){return super.copy(e,i),this.element=e.element.cloneNode(!0),this.center=e.center,this}}new re;new un;new un;new re;new re;class oy{constructor(e,i){this._group=new ml,this._frustum=new ef,this._frustumMat=new un,this._regenerateDelay=200,this._regenerateCounter=0,this.material=new Ri({color:"#2e3338"}),this.numbers=new ml,this.maxRegenerateRetrys=4,this.gridsFactor=5,this._scaleX=1,this._scaleY=1,this._offsetX=0,this._offsetY=0,this._camera=e,this._container=i;const n=this.newGrid(-1),o=this.newGrid(-2);this.grids={main:n,secondary:o},this._group.add(o,n,this.numbers)}set scaleX(e){this._scaleX=e,this.regenerate()}get scaleX(){return this._scaleX}set scaleY(e){this._scaleY=e,this.regenerate()}get scaleY(){return this._scaleY}set offsetX(e){this._offsetX=e,this.regenerate()}get offsetX(){return this._offsetX}set offsetY(e){this._offsetY=e,this.regenerate()}get offsetY(){return this._offsetY}get(){return this._group}dispose(){const{main:e,secondary:i}=this.grids;e.removeFromParent(),i.removeFromParent(),e.geometry.dispose(),e.material.dispose(),i.geometry.dispose(),i.material.dispose()}regenerate(){if(!this.isGridReady()){if(this._regenerateCounter++,this._regenerateCounter>this.maxRegenerateRetrys)throw new Error("Grid could not be regenerated");setTimeout(()=>this.regenerate,this._regenerateDelay);return}this._regenerateCounter=0,this._camera.updateMatrix(),this._camera.updateMatrixWorld();const e=this._frustumMat.multiplyMatrices(this._camera.projectionMatrix,this._camera.matrixWorldInverse);this._frustum.setFromProjectionMatrix(e);const{planes:i}=this._frustum,n=i[0].constant*-i[0].normal.x,o=i[1].constant*-i[1].normal.x,r=i[2].constant*-i[2].normal.y,s=i[3].constant*-i[3].normal.y,a=Math.abs(n-o),l=Math.abs(s-r),{clientWidth:c,clientHeight:d}=this._container,u=Math.max(c,d),h=Math.max(a,l)/u,p=Math.ceil(Math.log10(a/this.scaleX)),m=Math.ceil(Math.log10(l/this.scaleY)),g=10**(p-2)*this.scaleX,f=10**(m-2)*this.scaleY,v=g*this.gridsFactor,b=f*this.gridsFactor,y=Math.ceil(l/b),$=Math.ceil(a/v),A=Math.ceil(l/f),E=Math.ceil(a/g),O=g*Math.ceil(o/g),D=f*Math.ceil(r/f),P=v*Math.ceil(o/v),T=b*Math.ceil(r/b),Y=[...this.numbers.children];for(const le of Y)le.removeFromParent();this.numbers.children=[];const B=[],ae=9*h,I=1e4,U=P+this._offsetX,te=Math.round(Math.abs(U/this.scaleX)*I)/I,X=($-1)*v,H=Math.round(Math.abs((U+X)/this.scaleX)*I)/I,q=Math.max(te,H).toString().length*ae;let fe=Math.ceil(q/v)*v;for(let le=0;le<$;le++){let ce=P+le*v;B.push(ce,s,0,ce,r,0),ce=Math.round(ce*I)/I,fe=Math.round(fe*I)/I;const R=ce%fe;if(!(v<1||b<1)&&Math.abs(R)>.01)continue;const j=this.newNumber((ce+this._offsetX)/this.scaleX),z=12*h;j.position.set(ce,r+z,0)}for(let le=0;le<y;le++){const ce=T+le*b;B.push(o,ce,0,n,ce,0);const R=this.newNumber(ce/this.scaleY);let j=12;R.element.textContent&&(j+=4*R.element.textContent.length);const z=j*h;R.position.set(o+z,ce,0)}const dt=[];for(let le=0;le<E;le++){const ce=O+le*g;dt.push(ce,s,0,ce,r,0)}for(let le=0;le<A;le++){const ce=D+le*f;dt.push(o,ce,0,n,ce,0)}const ve=new Bt(new Float32Array(B),3),wt=new Bt(new Float32Array(dt),3),{main:tt,secondary:ii}=this.grids;tt.geometry.setAttribute("position",ve),ii.geometry.setAttribute("position",wt)}newNumber(e){const i=document.createElement("bim-label");i.textContent=String(Math.round(e*100)/100);const n=new ny(i);return this.numbers.add(n),n}newGrid(e){const i=new Bi,n=new ha(i,this.material);return n.frustumCulled=!1,n.renderOrder=e,n}isGridReady(){const e=this._camera.projectionMatrix.elements;for(let i=0;i<e.length;i++){const n=e[i];if(Number.isNaN(n))return!1}return!0}}var ry=Object.defineProperty,sy=Object.getOwnPropertyDescriptor,_o=(t,e,i,n)=>{for(var o=sy(e,i),r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&ry(e,i,o),o};const Yu=class extends fi{constructor(){super(...arguments),this._grid=null,this._world=null,this.resize=()=>{this._world&&this._grid&&this._grid.regenerate()}}set gridColor(e){if(this._gridColor=e,!(e&&this._grid))return;const i=Number(e.replace("#","0x"));Number.isNaN(i)||this._grid.material.color.setHex(i)}get gridColor(){return this._gridColor}set gridScaleX(e){this._gridScaleX=e,e&&this._grid&&(this._grid.scaleX=e)}get gridScaleX(){return this._gridScaleX}set gridScaleY(e){this._gridScaleY=e,e&&this._grid&&(this._grid.scaleY=e)}get gridScaleY(){return this._gridScaleY}get gridOffsetX(){var e;return((e=this._grid)==null?void 0:e.offsetX)||0}set gridOffsetX(e){this._grid&&(this._grid.offsetX=e)}get gridOffsetY(){var e;return((e=this._grid)==null?void 0:e.offsetY)||0}set gridOffsetY(e){this._grid&&(this._grid.offsetY=e)}set components(e){this.dispose();const i=e.get(Er).create();this._world=i,i.scene=new da(e),i.scene.setup(),i.renderer=new Qp(e,this);const n=new ua(e);i.camera=n;const o=new oy(n.threeOrtho,this);this._grid=o,i.scene.three.add(o.get()),n.controls.addEventListener("update",()=>o.regenerate()),setTimeout(async()=>{i.camera.updateAspect(),n.set("Plan"),await n.controls.setLookAt(0,0,100,0,0,0),await n.projection.set("Orthographic"),n.controls.dollySpeed=3,n.controls.draggingSmoothTime=.085,n.controls.maxZoom=1e3,n.controls.zoom(4)})}get world(){return this._world}dispose(){var e;(e=this.world)==null||e.dispose(),this._world=null,this._grid=null}connectedCallback(){super.connectedCallback(),new ResizeObserver(this.resize).observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.dispose()}render(){return Ua`<slot></slot>`}};Yu.styles=Ba`
    :host {
      position: relative;
      display: flex;
      min-width: 0px;
      height: 100%;
      background-color: var(--bim-ui_bg-base);
    }
  `;let xo=Yu;_o([Te({type:String,attribute:"grid-color",reflect:!0})],xo.prototype,"gridColor");_o([Te({type:Number,attribute:"grid-scale-x",reflect:!0})],xo.prototype,"gridScaleX");_o([Te({type:Number,attribute:"grid-scale-y",reflect:!0})],xo.prototype,"gridScaleY");_o([Te({type:Number,attribute:"grid-offset-x",reflect:!0})],xo.prototype,"gridOffsetX");_o([Te({type:Number,attribute:"grid-offset-y",reflect:!0})],xo.prototype,"gridOffsetY");var ay=Object.defineProperty,Zt=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&ay(e,i,o),o};const Xu=class extends fi{constructor(){super(...arguments),this._defaults={size:60},this._cssMatrix3D="",this._matrix=new un,this._onRightClick=new Event("rightclick"),this._onLeftClick=new Event("leftclick"),this._onTopClick=new Event("topclick"),this._onBottomClick=new Event("bottomclick"),this._onFrontClick=new Event("frontclick"),this._onBackClick=new Event("backclick"),this._camera=null,this._epsilon=e=>Math.abs(e)<1e-10?0:e}set camera(e){this._camera=e,this.updateOrientation()}get camera(){return this._camera}updateOrientation(){if(!this.camera)return;this._matrix.extractRotation(this.camera.matrixWorldInverse);const{elements:e}=this._matrix;this._cssMatrix3D=`matrix3d(
      ${this._epsilon(e[0])},
      ${this._epsilon(-e[1])},
      ${this._epsilon(e[2])},
      ${this._epsilon(e[3])},
      ${this._epsilon(e[4])},
      ${this._epsilon(-e[5])},
      ${this._epsilon(e[6])},
      ${this._epsilon(e[7])},
      ${this._epsilon(e[8])},
      ${this._epsilon(-e[9])},
      ${this._epsilon(e[10])},
      ${this._epsilon(e[11])},
      ${this._epsilon(e[12])},
      ${this._epsilon(-e[13])},
      ${this._epsilon(e[14])},
      ${this._epsilon(e[15])})
    `}render(){const e=this.size??this._defaults.size;return Ua`
      <style>
        .face,
        .cube {
          width: ${e}px;
          height: ${e}px;
          transform: translateZ(-300px) ${this._cssMatrix3D};
        }

        .face-right {
          translate: ${e/2}px 0 0;
        }

        .face-left {
          translate: ${-e/2}px 0 0;
        }

        .face-top {
          translate: 0 ${e/2}px 0;
        }

        .face-bottom {
          translate: 0 ${-e/2}px 0;
        }

        .face-front {
          translate: 0 0 ${e/2}px;
        }

        .face-back {
          translate: 0 0 ${-e/2}px;
        }
      </style>
      <div class="parent">
        <div class="cube">
          <div
            class="face x-direction face-right"
            @click=${()=>this.dispatchEvent(this._onRightClick)}
          >
            ${this.rightText}
          </div>
          <div
            class="face x-direction face-left"
            @click=${()=>this.dispatchEvent(this._onLeftClick)}
          >
            ${this.leftText}
          </div>
          <div
            class="face y-direction face-top"
            @click=${()=>this.dispatchEvent(this._onTopClick)}
          >
            ${this.topText}
          </div>
          <div
            class="face y-direction face-bottom"
            @click=${()=>this.dispatchEvent(this._onBottomClick)}
          >
            ${this.bottomText}
          </div>
          <div
            class="face z-direction face-front"
            @click=${()=>this.dispatchEvent(this._onFrontClick)}
          >
            ${this.frontText}
          </div>
          <div
            class="face z-direction face-back"
            @click=${()=>this.dispatchEvent(this._onBackClick)}
          >
            ${this.backText}
          </div>
        </div>
      </div>
    `}};Xu.styles=Ba`
    :host {
      position: absolute;
      z-index: 999;
      bottom: 1rem;
      right: 1rem;
    }

    .parent {
      perspective: 400px;
    }

    .cube {
      position: relative;
      transform-style: preserve-3d;
    }

    .face {
      position: absolute;
      display: flex;
      justify-content: center;
      user-select: none;
      align-items: center;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s;
      color: var(--bim-view-cube--c, white);
      font-size: var(--bim-view-cube--fz, --bim-ui_size-2xl);
    }

    .x-direction {
      // background-color: var(--bim-view-cube_x--bgc, #c93830DD);
      background-color: var(--bim-view-cube_x--bgc, #01a6bcde);
    }

    .x-direction:hover {
      background-color: var(--bim-ui_accent-base, white);
    }

    .y-direction {
      // background-color: var(--bim-view-cube_y--bgc, #54ff19DD);
      background-color: var(--bim-view-cube_y--bgc, #8d0ec8de);
    }

    .y-direction:hover {
      background-color: var(--bim-ui_accent-base, white);
    }

    .z-direction {
      // background-color: var(--bim-view-cube_z--bgc, #3041c9DD);
      background-color: var(--bim-view-cube_z--bgc, #2718afde);
    }

    .z-direction:hover {
      background-color: var(--bim-ui_accent-base, white);
    }

    .face-front {
      transform: rotateX(180deg);
    }

    .face-back {
      transform: rotateZ(180deg);
    }

    .face-top {
      transform: rotateX(90deg);
    }

    .face-bottom {
      transform: rotateX(270deg);
    }

    .face-right {
      transform: rotateY(-270deg) rotateX(180deg);
    }

    .face-left {
      transform: rotateY(-90deg) rotateX(180deg);
    }
  `;let Jt=Xu;Zt([Te({type:Number,reflect:!0})],Jt.prototype,"size");Zt([Te({type:String,attribute:"right-text",reflect:!0})],Jt.prototype,"rightText");Zt([Te({type:String,attribute:"left-text",reflect:!0})],Jt.prototype,"leftText");Zt([Te({type:String,attribute:"top-text",reflect:!0})],Jt.prototype,"topText");Zt([Te({type:String,attribute:"bottom-text",reflect:!0})],Jt.prototype,"bottomText");Zt([Te({type:String,attribute:"front-text",reflect:!0})],Jt.prototype,"frontText");Zt([Te({type:String,attribute:"back-text",reflect:!0})],Jt.prototype,"backText");Zt([iy()],Jt.prototype,"_cssMatrix3D");/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ly=t=>t.strings===void 0;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const cy={CHILD:2},dy=t=>(...e)=>({_$litDirective$:t,values:e});class uy{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,i,n){this._$Ct=e,this._$AM=i,this._$Ci=n}_$AS(e,i){return this.update(e,i)}update(e,i){return this.render(...i)}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const jn=(t,e)=>{var i;const n=t._$AN;if(n===void 0)return!1;for(const o of n)(i=o._$AO)==null||i.call(o,e,!1),jn(o,e);return!0},cr=t=>{let e,i;do{if((e=t._$AM)===void 0)break;i=e._$AN,i.delete(t),t=e}while(i?.size===0)},Zu=t=>{for(let e;e=t._$AM;t=e){let i=e._$AN;if(i===void 0)e._$AN=i=new Set;else if(i.has(t))break;i.add(t),fy(e)}};function hy(t){this._$AN!==void 0?(cr(this),this._$AM=t,Zu(this)):this._$AM=t}function py(t,e=!1,i=0){const n=this._$AH,o=this._$AN;if(o!==void 0&&o.size!==0)if(e)if(Array.isArray(n))for(let r=i;r<n.length;r++)jn(n[r],!1),cr(n[r]);else n!=null&&(jn(n,!1),cr(n));else jn(this,t)}const fy=t=>{t.type==cy.CHILD&&(t._$AP??(t._$AP=py),t._$AQ??(t._$AQ=hy))};let my=class extends uy{constructor(){super(...arguments),this._$AN=void 0}_$AT(t,e,i){super._$AT(t,e,i),Zu(this),this.isConnected=t._$AU}_$AO(t,e=!0){var i,n;t!==this.isConnected&&(this.isConnected=t,t?(i=this.reconnected)==null||i.call(this):(n=this.disconnected)==null||n.call(this)),e&&(jn(this,t),cr(this))}setValue(t){if(ly(this._$Ct))this._$Ct._$AI(t,this);else{const e=[...this._$Ct._$AH];e[this._$Ci]=t,this._$Ct._$AI(e,this,0)}}disconnected(){}reconnected(){}};/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Vs=()=>new by;class by{}const fs=new WeakMap,gy=dy(class extends my{render(t){return pe}update(t,[e]){var i;const n=e!==this.G;return n&&this.G!==void 0&&this.rt(void 0),(n||this.lt!==this.ct)&&(this.G=e,this.ht=(i=t.options)==null?void 0:i.host,this.rt(this.ct=t.element)),pe}rt(t){if(this.isConnected||(t=void 0),typeof this.G=="function"){const e=this.ht??globalThis;let i=fs.get(e);i===void 0&&(i=new WeakMap,fs.set(e,i)),i.get(this.G)!==void 0&&this.G.call(this.ht,void 0),i.set(this.G,t),t!==void 0&&this.G.call(this.ht,t)}else this.G.value=t}get lt(){var t,e;return typeof this.G=="function"?(t=fs.get(this.ht??globalThis))==null?void 0:t.get(this.G):(e=this.G)==null?void 0:e.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}});var yy=Object.defineProperty,vy=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&yy(e,i,o),o};const Ju=class extends fi{constructor(){super(...arguments),this.world=null,this._components=null,this._viewport=Vs()}set components(e){var i;if(this._components=e,this.components){const n=this.components.get(Er);this.world=n.create(),this.world.name=this.name}else(i=this.world)==null||i.dispose(),this.world=null}get components(){return this._components}connectedCallback(){super.connectedCallback(),this.world&&(this.world.enabled=!0)}disconnectedCallback(){super.disconnectedCallback(),this.world&&(this.world.enabled=!1)}dispose(){this.components=null,this.remove()}firstUpdated(){const{value:e}=this._viewport;if(!(this.components&&e&&this.world))return;const i=new da(this.components);this.world.scene=i,i.setup(),i.three.background=null;const n=new fd(this.components,e);this.world.renderer=n;const o=new ua(this.components);this.world.camera=o;const r=this.components.get(md).create(this.world);r.material.uniforms.uColor.value=new Xo(4342338),r.material.uniforms.uSize1.value=2,r.material.uniforms.uSize2.value=8}onSlotChange(){const e=new Event("slotchange");this.dispatchEvent(e)}render(){return Ua` <bim-viewport ${gy(this._viewport)}>
      <slot @slotchange=${this.onSlotChange}></slot>
    </bim-viewport>`}};Ju.styles=Ba``;let wy=Ju;vy([Te({type:String,reflect:!0})],wy.prototype,"name");var $y=Object.defineProperty,_y=(t,e,i)=>e in t?$y(t,e,{enumerable:!0,configurable:!0,writable:!0,value:i}):t[e]=i,si=(t,e,i)=>(_y(t,typeof e!="symbol"?e+"":e,i),i);const on=Math.min,At=Math.max,dr=Math.round,Ht=t=>({x:t,y:t}),xy={left:"right",right:"left",bottom:"top",top:"bottom"},Ey={start:"end",end:"start"};function _c(t,e,i){return At(t,on(e,i))}function Eo(t,e){return typeof t=="function"?t(e):t}function Ot(t){return t.split("-")[0]}function qr(t){return t.split("-")[1]}function Ku(t){return t==="x"?"y":"x"}function Qu(t){return t==="y"?"height":"width"}const Sy=new Set(["top","bottom"]);function Et(t){return Sy.has(Ot(t))?"y":"x"}function eh(t){return Ku(Et(t))}function Ay(t,e,i){i===void 0&&(i=!1);const n=qr(t),o=eh(t),r=Qu(o);let s=o==="x"?n===(i?"end":"start")?"right":"left":n==="start"?"bottom":"top";return e.reference[r]>e.floating[r]&&(s=ur(s)),[s,ur(s)]}function Cy(t){const e=ur(t);return[Gs(t),e,Gs(e)]}function Gs(t){return t.replace(/start|end/g,e=>Ey[e])}const xc=["left","right"],Ec=["right","left"],ky=["top","bottom"],Ty=["bottom","top"];function Oy(t,e,i){switch(t){case"top":case"bottom":return i?e?Ec:xc:e?xc:Ec;case"left":case"right":return e?ky:Ty;default:return[]}}function Iy(t,e,i,n){const o=qr(t);let r=Oy(Ot(t),i==="start",n);return o&&(r=r.map(s=>s+"-"+o),e&&(r=r.concat(r.map(Gs)))),r}function ur(t){return t.replace(/left|right|bottom|top/g,e=>xy[e])}function Py(t){return{top:0,right:0,bottom:0,left:0,...t}}function th(t){return typeof t!="number"?Py(t):{top:t,right:t,bottom:t,left:t}}function rn(t){const{x:e,y:i,width:n,height:o}=t;return{width:n,height:o,top:i,left:e,right:e+n,bottom:i+o,x:e,y:i}}function Sc(t,e,i){let{reference:n,floating:o}=t;const r=Et(e),s=eh(e),a=Qu(s),l=Ot(e),c=r==="y",d=n.x+n.width/2-o.width/2,u=n.y+n.height/2-o.height/2,h=n[a]/2-o[a]/2;let p;switch(l){case"top":p={x:d,y:n.y-o.height};break;case"bottom":p={x:d,y:n.y+n.height};break;case"right":p={x:n.x+n.width,y:u};break;case"left":p={x:n.x-o.width,y:u};break;default:p={x:n.x,y:n.y}}switch(qr(e)){case"start":p[s]-=h*(i&&c?-1:1);break;case"end":p[s]+=h*(i&&c?-1:1);break}return p}const zy=async(t,e,i)=>{const{placement:n="bottom",strategy:o="absolute",middleware:r=[],platform:s}=i,a=r.filter(Boolean),l=await(s.isRTL==null?void 0:s.isRTL(e));let c=await s.getElementRects({reference:t,floating:e,strategy:o}),{x:d,y:u}=Sc(c,n,l),h=n,p={},m=0;for(let g=0;g<a.length;g++){const{name:f,fn:v}=a[g],{x:b,y,data:$,reset:A}=await v({x:d,y:u,initialPlacement:n,placement:h,strategy:o,middlewareData:p,rects:c,platform:s,elements:{reference:t,floating:e}});d=b??d,u=y??u,p={...p,[f]:{...p[f],...$}},A&&m<=50&&(m++,typeof A=="object"&&(A.placement&&(h=A.placement),A.rects&&(c=A.rects===!0?await s.getElementRects({reference:t,floating:e,strategy:o}):A.rects),{x:d,y:u}=Sc(c,h,l)),g=-1)}return{x:d,y:u,placement:h,strategy:o,middlewareData:p}};async function ih(t,e){var i;e===void 0&&(e={});const{x:n,y:o,platform:r,rects:s,elements:a,strategy:l}=t,{boundary:c="clippingAncestors",rootBoundary:d="viewport",elementContext:u="floating",altBoundary:h=!1,padding:p=0}=Eo(e,t),m=th(p),g=a[h?u==="floating"?"reference":"floating":u],f=rn(await r.getClippingRect({element:(i=await(r.isElement==null?void 0:r.isElement(g)))==null||i?g:g.contextElement||await(r.getDocumentElement==null?void 0:r.getDocumentElement(a.floating)),boundary:c,rootBoundary:d,strategy:l})),v=u==="floating"?{x:n,y:o,width:s.floating.width,height:s.floating.height}:s.reference,b=await(r.getOffsetParent==null?void 0:r.getOffsetParent(a.floating)),y=await(r.isElement==null?void 0:r.isElement(b))?await(r.getScale==null?void 0:r.getScale(b))||{x:1,y:1}:{x:1,y:1},$=rn(r.convertOffsetParentRelativeRectToViewportRelativeRect?await r.convertOffsetParentRelativeRectToViewportRelativeRect({elements:a,rect:v,offsetParent:b,strategy:l}):v);return{top:(f.top-$.top+m.top)/y.y,bottom:($.bottom-f.bottom+m.bottom)/y.y,left:(f.left-$.left+m.left)/y.x,right:($.right-f.right+m.right)/y.x}}const Ly=function(t){return t===void 0&&(t={}),{name:"flip",options:t,async fn(e){var i,n;const{placement:o,middlewareData:r,rects:s,initialPlacement:a,platform:l,elements:c}=e,{mainAxis:d=!0,crossAxis:u=!0,fallbackPlacements:h,fallbackStrategy:p="bestFit",fallbackAxisSideDirection:m="none",flipAlignment:g=!0,...f}=Eo(t,e);if((i=r.arrow)!=null&&i.alignmentOffset)return{};const v=Ot(o),b=Et(a),y=Ot(a)===a,$=await(l.isRTL==null?void 0:l.isRTL(c.floating)),A=h||(y||!g?[ur(a)]:Cy(a)),E=m!=="none";!h&&E&&A.push(...Iy(a,g,m,$));const O=[a,...A],D=await ih(e,f),P=[];let T=((n=r.flip)==null?void 0:n.overflows)||[];if(d&&P.push(D[v]),u){const I=Ay(o,s,$);P.push(D[I[0]],D[I[1]])}if(T=[...T,{placement:o,overflows:P}],!P.every(I=>I<=0)){var Y,B;const I=(((Y=r.flip)==null?void 0:Y.index)||0)+1,U=O[I];if(U&&(!(u==="alignment"&&b!==Et(U))||T.every(X=>Et(X.placement)===b?X.overflows[0]>0:!0)))return{data:{index:I,overflows:T},reset:{placement:U}};let te=(B=T.filter(X=>X.overflows[0]<=0).sort((X,H)=>X.overflows[1]-H.overflows[1])[0])==null?void 0:B.placement;if(!te)switch(p){case"bestFit":{var ae;const X=(ae=T.filter(H=>{if(E){const q=Et(H.placement);return q===b||q==="y"}return!0}).map(H=>[H.placement,H.overflows.filter(q=>q>0).reduce((q,fe)=>q+fe,0)]).sort((H,q)=>H[1]-q[1])[0])==null?void 0:ae[0];X&&(te=X);break}case"initialPlacement":te=a;break}if(o!==te)return{reset:{placement:te}}}return{}}}};function nh(t){const e=on(...t.map(r=>r.left)),i=on(...t.map(r=>r.top)),n=At(...t.map(r=>r.right)),o=At(...t.map(r=>r.bottom));return{x:e,y:i,width:n-e,height:o-i}}function My(t){const e=t.slice().sort((o,r)=>o.y-r.y),i=[];let n=null;for(let o=0;o<e.length;o++){const r=e[o];!n||r.y-n.y>n.height/2?i.push([r]):i[i.length-1].push(r),n=r}return i.map(o=>rn(nh(o)))}const Dy=function(t){return t===void 0&&(t={}),{name:"inline",options:t,async fn(e){const{placement:i,elements:n,rects:o,platform:r,strategy:s}=e,{padding:a=2,x:l,y:c}=Eo(t,e),d=Array.from(await(r.getClientRects==null?void 0:r.getClientRects(n.reference))||[]),u=My(d),h=rn(nh(d)),p=th(a);function m(){if(u.length===2&&u[0].left>u[1].right&&l!=null&&c!=null)return u.find(f=>l>f.left-p.left&&l<f.right+p.right&&c>f.top-p.top&&c<f.bottom+p.bottom)||h;if(u.length>=2){if(Et(i)==="y"){const T=u[0],Y=u[u.length-1],B=Ot(i)==="top",ae=T.top,I=Y.bottom,U=B?T.left:Y.left,te=B?T.right:Y.right,X=te-U,H=I-ae;return{top:ae,bottom:I,left:U,right:te,width:X,height:H,x:U,y:ae}}const f=Ot(i)==="left",v=At(...u.map(T=>T.right)),b=on(...u.map(T=>T.left)),y=u.filter(T=>f?T.left===b:T.right===v),$=y[0].top,A=y[y.length-1].bottom,E=b,O=v,D=O-E,P=A-$;return{top:$,bottom:A,left:E,right:O,width:D,height:P,x:E,y:$}}return h}const g=await r.getElementRects({reference:{getBoundingClientRect:m},floating:n.floating,strategy:s});return o.reference.x!==g.reference.x||o.reference.y!==g.reference.y||o.reference.width!==g.reference.width||o.reference.height!==g.reference.height?{reset:{rects:g}}:{}}}},jy=new Set(["left","top"]);async function Ry(t,e){const{placement:i,platform:n,elements:o}=t,r=await(n.isRTL==null?void 0:n.isRTL(o.floating)),s=Ot(i),a=qr(i),l=Et(i)==="y",c=jy.has(s)?-1:1,d=r&&l?-1:1,u=Eo(e,t);let{mainAxis:h,crossAxis:p,alignmentAxis:m}=typeof u=="number"?{mainAxis:u,crossAxis:0,alignmentAxis:null}:{mainAxis:u.mainAxis||0,crossAxis:u.crossAxis||0,alignmentAxis:u.alignmentAxis};return a&&typeof m=="number"&&(p=a==="end"?m*-1:m),l?{x:p*d,y:h*c}:{x:h*c,y:p*d}}const Ha=function(t){return{name:"offset",options:t,async fn(e){var i,n;const{x:o,y:r,placement:s,middlewareData:a}=e,l=await Ry(e,t);return s===((i=a.offset)==null?void 0:i.placement)&&(n=a.arrow)!=null&&n.alignmentOffset?{}:{x:o+l.x,y:r+l.y,data:{...l,placement:s}}}}},By=function(t){return t===void 0&&(t={}),{name:"shift",options:t,async fn(e){const{x:i,y:n,placement:o}=e,{mainAxis:r=!0,crossAxis:s=!1,limiter:a={fn:f=>{let{x:v,y:b}=f;return{x:v,y:b}}},...l}=Eo(t,e),c={x:i,y:n},d=await ih(e,l),u=Et(Ot(o)),h=Ku(u);let p=c[h],m=c[u];if(r){const f=h==="y"?"top":"left",v=h==="y"?"bottom":"right",b=p+d[f],y=p-d[v];p=_c(b,p,y)}if(s){const f=u==="y"?"top":"left",v=u==="y"?"bottom":"right",b=m+d[f],y=m-d[v];m=_c(b,m,y)}const g=a.fn({...e,[h]:p,[u]:m});return{...g,data:{x:g.x-i,y:g.y-n,enabled:{[h]:r,[u]:s}}}}}};function Vr(){return typeof window<"u"}function qt(t){return oh(t)?(t.nodeName||"").toLowerCase():"#document"}function je(t){var e;return(t==null||(e=t.ownerDocument)==null?void 0:e.defaultView)||window}function Kt(t){var e;return(e=(oh(t)?t.ownerDocument:t.document)||window.document)==null?void 0:e.documentElement}function oh(t){return Vr()?t instanceof Node||t instanceof je(t).Node:!1}function bt(t){return Vr()?t instanceof Element||t instanceof je(t).Element:!1}function gt(t){return Vr()?t instanceof HTMLElement||t instanceof je(t).HTMLElement:!1}function Ac(t){return!Vr()||typeof ShadowRoot>"u"?!1:t instanceof ShadowRoot||t instanceof je(t).ShadowRoot}const Ny=new Set(["inline","contents"]);function So(t){const{overflow:e,overflowX:i,overflowY:n,display:o}=Ge(t);return/auto|scroll|overlay|hidden|clip/.test(e+n+i)&&!Ny.has(o)}const Fy=new Set(["table","td","th"]);function Uy(t){return Fy.has(qt(t))}const Hy=[":popover-open",":modal"];function qy(t){return Hy.some(e=>{try{return t.matches(e)}catch{return!1}})}const Vy=["transform","translate","scale","rotate","perspective"],Gy=["transform","translate","scale","rotate","perspective","filter"],Wy=["paint","layout","strict","content"];function qa(t){const e=Va(),i=bt(t)?Ge(t):t;return Vy.some(n=>i[n]?i[n]!=="none":!1)||(i.containerType?i.containerType!=="normal":!1)||!e&&(i.backdropFilter?i.backdropFilter!=="none":!1)||!e&&(i.filter?i.filter!=="none":!1)||Gy.some(n=>(i.willChange||"").includes(n))||Wy.some(n=>(i.contain||"").includes(n))}function Yy(t){let e=sn(t);for(;gt(e)&&!Gr(e);){if(qa(e))return e;if(qy(e))return null;e=sn(e)}return null}function Va(){return typeof CSS>"u"||!CSS.supports?!1:CSS.supports("-webkit-backdrop-filter","none")}const Xy=new Set(["html","body","#document"]);function Gr(t){return Xy.has(qt(t))}function Ge(t){return je(t).getComputedStyle(t)}function Wr(t){return bt(t)?{scrollLeft:t.scrollLeft,scrollTop:t.scrollTop}:{scrollLeft:t.scrollX,scrollTop:t.scrollY}}function sn(t){if(qt(t)==="html")return t;const e=t.assignedSlot||t.parentNode||Ac(t)&&t.host||Kt(t);return Ac(e)?e.host:e}function rh(t){const e=sn(t);return Gr(e)?t.ownerDocument?t.ownerDocument.body:t.body:gt(e)&&So(e)?e:rh(e)}function sh(t,e,i){var n;e===void 0&&(e=[]);const o=rh(t),r=o===((n=t.ownerDocument)==null?void 0:n.body),s=je(o);return r?(Zy(s),e.concat(s,s.visualViewport||[],So(o)?o:[],[])):e.concat(o,sh(o,[]))}function Zy(t){return t.parent&&Object.getPrototypeOf(t.parent)?t.frameElement:null}function ah(t){const e=Ge(t);let i=parseFloat(e.width)||0,n=parseFloat(e.height)||0;const o=gt(t),r=o?t.offsetWidth:i,s=o?t.offsetHeight:n,a=dr(i)!==r||dr(n)!==s;return a&&(i=r,n=s),{width:i,height:n,$:a}}function lh(t){return bt(t)?t:t.contextElement}function Ui(t){const e=lh(t);if(!gt(e))return Ht(1);const i=e.getBoundingClientRect(),{width:n,height:o,$:r}=ah(e);let s=(r?dr(i.width):i.width)/n,a=(r?dr(i.height):i.height)/o;return(!s||!Number.isFinite(s))&&(s=1),(!a||!Number.isFinite(a))&&(a=1),{x:s,y:a}}const Jy=Ht(0);function ch(t){const e=je(t);return!Va()||!e.visualViewport?Jy:{x:e.visualViewport.offsetLeft,y:e.visualViewport.offsetTop}}function Ky(t,e,i){return e===void 0&&(e=!1),!i||e&&i!==je(t)?!1:e}function Qn(t,e,i,n){e===void 0&&(e=!1),i===void 0&&(i=!1);const o=t.getBoundingClientRect(),r=lh(t);let s=Ht(1);e&&(n?bt(n)&&(s=Ui(n)):s=Ui(t));const a=Ky(r,i,n)?ch(r):Ht(0);let l=(o.left+a.x)/s.x,c=(o.top+a.y)/s.y,d=o.width/s.x,u=o.height/s.y;if(r){const h=je(r),p=n&&bt(n)?je(n):n;let m=h,g=m.frameElement;for(;g&&n&&p!==m;){const f=Ui(g),v=g.getBoundingClientRect(),b=Ge(g),y=v.left+(g.clientLeft+parseFloat(b.paddingLeft))*f.x,$=v.top+(g.clientTop+parseFloat(b.paddingTop))*f.y;l*=f.x,c*=f.y,d*=f.x,u*=f.y,l+=y,c+=$,m=je(g),g=m.frameElement}}return rn({width:d,height:u,x:l,y:c})}const Qy=[":popover-open",":modal"];function dh(t){return Qy.some(e=>{try{return t.matches(e)}catch{return!1}})}function ev(t){let{elements:e,rect:i,offsetParent:n,strategy:o}=t;const r=o==="fixed",s=Kt(n),a=e?dh(e.floating):!1;if(n===s||a&&r)return i;let l={scrollLeft:0,scrollTop:0},c=Ht(1);const d=Ht(0),u=gt(n);if((u||!u&&!r)&&((qt(n)!=="body"||So(s))&&(l=Wr(n)),gt(n))){const h=Qn(n);c=Ui(n),d.x=h.x+n.clientLeft,d.y=h.y+n.clientTop}return{width:i.width*c.x,height:i.height*c.y,x:i.x*c.x-l.scrollLeft*c.x+d.x,y:i.y*c.y-l.scrollTop*c.y+d.y}}function tv(t){return Array.from(t.getClientRects())}function uh(t){return Qn(Kt(t)).left+Wr(t).scrollLeft}function iv(t){const e=Kt(t),i=Wr(t),n=t.ownerDocument.body,o=At(e.scrollWidth,e.clientWidth,n.scrollWidth,n.clientWidth),r=At(e.scrollHeight,e.clientHeight,n.scrollHeight,n.clientHeight);let s=-i.scrollLeft+uh(t);const a=-i.scrollTop;return Ge(n).direction==="rtl"&&(s+=At(e.clientWidth,n.clientWidth)-o),{width:o,height:r,x:s,y:a}}function nv(t,e){const i=je(t),n=Kt(t),o=i.visualViewport;let r=n.clientWidth,s=n.clientHeight,a=0,l=0;if(o){r=o.width,s=o.height;const c=Va();(!c||c&&e==="fixed")&&(a=o.offsetLeft,l=o.offsetTop)}return{width:r,height:s,x:a,y:l}}function ov(t,e){const i=Qn(t,!0,e==="fixed"),n=i.top+t.clientTop,o=i.left+t.clientLeft,r=gt(t)?Ui(t):Ht(1),s=t.clientWidth*r.x,a=t.clientHeight*r.y,l=o*r.x,c=n*r.y;return{width:s,height:a,x:l,y:c}}function Cc(t,e,i){let n;if(e==="viewport")n=nv(t,i);else if(e==="document")n=iv(Kt(t));else if(bt(e))n=ov(e,i);else{const o=ch(t);n={...e,x:e.x-o.x,y:e.y-o.y}}return rn(n)}function hh(t,e){const i=sn(t);return i===e||!bt(i)||Gr(i)?!1:Ge(i).position==="fixed"||hh(i,e)}function rv(t,e){const i=e.get(t);if(i)return i;let n=sh(t,[]).filter(a=>bt(a)&&qt(a)!=="body"),o=null;const r=Ge(t).position==="fixed";let s=r?sn(t):t;for(;bt(s)&&!Gr(s);){const a=Ge(s),l=qa(s);!l&&a.position==="fixed"&&(o=null),(r?!l&&!o:!l&&a.position==="static"&&o&&["absolute","fixed"].includes(o.position)||So(s)&&!l&&hh(t,s))?n=n.filter(c=>c!==s):o=a,s=sn(s)}return e.set(t,n),n}function sv(t){let{element:e,boundary:i,rootBoundary:n,strategy:o}=t;const r=[...i==="clippingAncestors"?rv(e,this._c):[].concat(i),n],s=r[0],a=r.reduce((l,c)=>{const d=Cc(e,c,o);return l.top=At(d.top,l.top),l.right=on(d.right,l.right),l.bottom=on(d.bottom,l.bottom),l.left=At(d.left,l.left),l},Cc(e,s,o));return{width:a.right-a.left,height:a.bottom-a.top,x:a.left,y:a.top}}function av(t){const{width:e,height:i}=ah(t);return{width:e,height:i}}function lv(t,e,i){const n=gt(e),o=Kt(e),r=i==="fixed",s=Qn(t,!0,r,e);let a={scrollLeft:0,scrollTop:0};const l=Ht(0);if(n||!n&&!r)if((qt(e)!=="body"||So(o))&&(a=Wr(e)),n){const u=Qn(e,!0,r,e);l.x=u.x+e.clientLeft,l.y=u.y+e.clientTop}else o&&(l.x=uh(o));const c=s.left+a.scrollLeft-l.x,d=s.top+a.scrollTop-l.y;return{x:c,y:d,width:s.width,height:s.height}}function kc(t,e){return!gt(t)||Ge(t).position==="fixed"?null:e?e(t):t.offsetParent}function ph(t,e){const i=je(t);if(!gt(t)||dh(t))return i;let n=kc(t,e);for(;n&&Uy(n)&&Ge(n).position==="static";)n=kc(n,e);return n&&(qt(n)==="html"||qt(n)==="body"&&Ge(n).position==="static"&&!qa(n))?i:n||Yy(t)||i}const cv=async function(t){const e=this.getOffsetParent||ph,i=this.getDimensions;return{reference:lv(t.reference,await e(t.floating),t.strategy),floating:{x:0,y:0,...await i(t.floating)}}};function dv(t){return Ge(t).direction==="rtl"}const uv={convertOffsetParentRelativeRectToViewportRelativeRect:ev,getDocumentElement:Kt,getClippingRect:sv,getOffsetParent:ph,getElementRects:cv,getClientRects:tv,getDimensions:av,getScale:Ui,isElement:bt,isRTL:dv},Ga=By,Wa=Ly,Ya=Dy,Xa=(t,e,i)=>{const n=new Map,o={platform:uv,...i},r={...o.platform,_c:n};return zy(t,e,{...o,platform:r})};/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Vo=globalThis,Za=Vo.ShadowRoot&&(Vo.ShadyCSS===void 0||Vo.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Ja=Symbol(),Tc=new WeakMap;let fh=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==Ja)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(Za&&t===void 0){const i=e!==void 0&&e.length===1;i&&(t=Tc.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&Tc.set(e,t))}return t}toString(){return this.cssText}};const hv=t=>new fh(typeof t=="string"?t:t+"",void 0,Ja),ee=(t,...e)=>{const i=t.length===1?t[0]:e.reduce((n,o,r)=>n+(s=>{if(s._$cssResult$===!0)return s.cssText;if(typeof s=="number")return s;throw Error("Value passed to 'css' function must be a 'css' function result: "+s+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(o)+t[r+1],t[0]);return new fh(i,t,Ja)},pv=(t,e)=>{if(Za)t.adoptedStyleSheets=e.map(i=>i instanceof CSSStyleSheet?i:i.styleSheet);else for(const i of e){const n=document.createElement("style"),o=Vo.litNonce;o!==void 0&&n.setAttribute("nonce",o),n.textContent=i.cssText,t.appendChild(n)}},Oc=Za?t=>t:t=>t instanceof CSSStyleSheet?(e=>{let i="";for(const n of e.cssRules)i+=n.cssText;return hv(i)})(t):t;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:fv,defineProperty:mv,getOwnPropertyDescriptor:bv,getOwnPropertyNames:gv,getOwnPropertySymbols:yv,getPrototypeOf:vv}=Object,an=globalThis,Ic=an.trustedTypes,wv=Ic?Ic.emptyScript:"",Pc=an.reactiveElementPolyfillSupport,Rn=(t,e)=>t,hr={toAttribute(t,e){switch(e){case Boolean:t=t?wv:null;break;case Object:case Array:t=t==null?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=t!==null;break;case Number:i=t===null?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch{i=null}}return i}},Ka=(t,e)=>!fv(t,e),zc={attribute:!0,type:String,converter:hr,reflect:!1,useDefault:!1,hasChanged:Ka};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),an.litPropertyMetadata??(an.litPropertyMetadata=new WeakMap);let Di=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=zc){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),n=this.getPropertyDescriptor(t,i,e);n!==void 0&&mv(this.prototype,t,n)}}static getPropertyDescriptor(t,e,i){const{get:n,set:o}=bv(this.prototype,t)??{get(){return this[e]},set(r){this[e]=r}};return{get:n,set(r){const s=n?.call(this);o?.call(this,r),this.requestUpdate(t,s,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??zc}static _$Ei(){if(this.hasOwnProperty(Rn("elementProperties")))return;const t=vv(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(Rn("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Rn("properties"))){const e=this.properties,i=[...gv(e),...yv(e)];for(const n of i)this.createProperty(n,e[n])}const t=this[Symbol.metadata];if(t!==null){const e=litPropertyMetadata.get(t);if(e!==void 0)for(const[i,n]of e)this.elementProperties.set(i,n)}this._$Eh=new Map;for(const[e,i]of this.elementProperties){const n=this._$Eu(e,i);n!==void 0&&this._$Eh.set(n,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const n of i)e.unshift(Oc(n))}else t!==void 0&&e.push(Oc(t));return e}static _$Eu(t,e){const i=e.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(e=>e(this))}addController(t){var e;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((e=t.hostConnected)==null||e.call(t))}removeController(t){var e;(e=this._$EO)==null||e.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return pv(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(e=>{var i;return(i=e.hostConnected)==null?void 0:i.call(e)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(e=>{var i;return(i=e.hostDisconnected)==null?void 0:i.call(e)})}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){var i;const n=this.constructor.elementProperties.get(t),o=this.constructor._$Eu(t,n);if(o!==void 0&&n.reflect===!0){const r=(((i=n.converter)==null?void 0:i.toAttribute)!==void 0?n.converter:hr).toAttribute(e,n.type);this._$Em=t,r==null?this.removeAttribute(o):this.setAttribute(o,r),this._$Em=null}}_$AK(t,e){var i,n;const o=this.constructor,r=o._$Eh.get(t);if(r!==void 0&&this._$Em!==r){const s=o.getPropertyOptions(r),a=typeof s.converter=="function"?{fromAttribute:s.converter}:((i=s.converter)==null?void 0:i.fromAttribute)!==void 0?s.converter:hr;this._$Em=r;const l=a.fromAttribute(e,s.type);this[r]=l??((n=this._$Ej)==null?void 0:n.get(r))??l,this._$Em=null}}requestUpdate(t,e,i,n=!1,o){var r;if(t!==void 0){const s=this.constructor;if(n===!1&&(o=this[t]),i??(i=s.getPropertyOptions(t)),!((i.hasChanged??Ka)(o,e)||i.useDefault&&i.reflect&&o===((r=this._$Ej)==null?void 0:r.get(t))&&!this.hasAttribute(s._$Eu(t,i))))return;this.C(t,e,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:n,wrapped:o},r){i&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,r??e??this[t]),o!==!0||r!==void 0)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),n===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var t;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[o,r]of this._$Ep)this[o]=r;this._$Ep=void 0}const n=this.constructor.elementProperties;if(n.size>0)for(const[o,r]of n){const{wrapped:s}=r,a=this[o];s!==!0||this._$AL.has(o)||a===void 0||this.C(o,void 0,r,a)}}let e=!1;const i=this._$AL;try{e=this.shouldUpdate(i),e?(this.willUpdate(i),(t=this._$EO)==null||t.forEach(n=>{var o;return(o=n.hostUpdate)==null?void 0:o.call(n)}),this.update(i)):this._$EM()}catch(n){throw e=!1,this._$EM(),n}e&&this._$AE(i)}willUpdate(t){}_$AE(t){var e;(e=this._$EO)==null||e.forEach(i=>{var n;return(n=i.hostUpdated)==null?void 0:n.call(i)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(e=>this._$ET(e,this[e]))),this._$EM()}updated(t){}firstUpdated(t){}};Di.elementStyles=[],Di.shadowRootOptions={mode:"open"},Di[Rn("elementProperties")]=new Map,Di[Rn("finalized")]=new Map,Pc?.({ReactiveElement:Di}),(an.reactiveElementVersions??(an.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const pr=globalThis,Lc=t=>t,fr=pr.trustedTypes,Mc=fr?fr.createPolicy("lit-html",{createHTML:t=>t}):void 0,mh="$lit$",jt=`lit$${Math.random().toFixed(9).slice(2)}$`,bh="?"+jt,$v=`<${bh}>`,_i=document,eo=()=>_i.createComment(""),to=t=>t===null||typeof t!="object"&&typeof t!="function",Qa=Array.isArray,_v=t=>Qa(t)||typeof t?.[Symbol.iterator]=="function",ms=`[ 	
\f\r]`,On=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Dc=/-->/g,jc=/>/g,ai=RegExp(`>|${ms}(?:([^\\s"'>=/]+)(${ms}*=${ms}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Rc=/'/g,Bc=/"/g,gh=/^(?:script|style|textarea|title)$/i,xv=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),w=xv(1),xi=Symbol.for("lit-noChange"),ne=Symbol.for("lit-nothing"),Nc=new WeakMap,ui=_i.createTreeWalker(_i,129);function yh(t,e){if(!Qa(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return Mc!==void 0?Mc.createHTML(e):e}const Ev=(t,e)=>{const i=t.length-1,n=[];let o,r=e===2?"<svg>":e===3?"<math>":"",s=On;for(let a=0;a<i;a++){const l=t[a];let c,d,u=-1,h=0;for(;h<l.length&&(s.lastIndex=h,d=s.exec(l),d!==null);)h=s.lastIndex,s===On?d[1]==="!--"?s=Dc:d[1]!==void 0?s=jc:d[2]!==void 0?(gh.test(d[2])&&(o=RegExp("</"+d[2],"g")),s=ai):d[3]!==void 0&&(s=ai):s===ai?d[0]===">"?(s=o??On,u=-1):d[1]===void 0?u=-2:(u=s.lastIndex-d[2].length,c=d[1],s=d[3]===void 0?ai:d[3]==='"'?Bc:Rc):s===Bc||s===Rc?s=ai:s===Dc||s===jc?s=On:(s=ai,o=void 0);const p=s===ai&&t[a+1].startsWith("/>")?" ":"";r+=s===On?l+$v:u>=0?(n.push(c),l.slice(0,u)+mh+l.slice(u)+jt+p):l+jt+(u===-2?a:p)}return[yh(t,r+(t[i]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),n]};class io{constructor({strings:e,_$litType$:i},n){let o;this.parts=[];let r=0,s=0;const a=e.length-1,l=this.parts,[c,d]=Ev(e,i);if(this.el=io.createElement(c,n),ui.currentNode=this.el.content,i===2||i===3){const u=this.el.content.firstChild;u.replaceWith(...u.childNodes)}for(;(o=ui.nextNode())!==null&&l.length<a;){if(o.nodeType===1){if(o.hasAttributes())for(const u of o.getAttributeNames())if(u.endsWith(mh)){const h=d[s++],p=o.getAttribute(u).split(jt),m=/([.?@])?(.*)/.exec(h);l.push({type:1,index:r,name:m[2],strings:p,ctor:m[1]==="."?Av:m[1]==="?"?Cv:m[1]==="@"?kv:Yr}),o.removeAttribute(u)}else u.startsWith(jt)&&(l.push({type:6,index:r}),o.removeAttribute(u));if(gh.test(o.tagName)){const u=o.textContent.split(jt),h=u.length-1;if(h>0){o.textContent=fr?fr.emptyScript:"";for(let p=0;p<h;p++)o.append(u[p],eo()),ui.nextNode(),l.push({type:2,index:++r});o.append(u[h],eo())}}}else if(o.nodeType===8)if(o.data===bh)l.push({type:2,index:r});else{let u=-1;for(;(u=o.data.indexOf(jt,u+1))!==-1;)l.push({type:7,index:r}),u+=jt.length-1}r++}}static createElement(e,i){const n=_i.createElement("template");return n.innerHTML=e,n}}function ln(t,e,i=t,n){var o,r;if(e===xi)return e;let s=n!==void 0?(o=i._$Co)==null?void 0:o[n]:i._$Cl;const a=to(e)?void 0:e._$litDirective$;return s?.constructor!==a&&((r=s?._$AO)==null||r.call(s,!1),a===void 0?s=void 0:(s=new a(t),s._$AT(t,i,n)),n!==void 0?(i._$Co??(i._$Co=[]))[n]=s:i._$Cl=s),s!==void 0&&(e=ln(t,s._$AS(t,e.values),s,n)),e}class Sv{constructor(e,i){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=i}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:i},parts:n}=this._$AD,o=(e?.creationScope??_i).importNode(i,!0);ui.currentNode=o;let r=ui.nextNode(),s=0,a=0,l=n[0];for(;l!==void 0;){if(s===l.index){let c;l.type===2?c=new Ao(r,r.nextSibling,this,e):l.type===1?c=new l.ctor(r,l.name,l.strings,this,e):l.type===6&&(c=new Tv(r,this,e)),this._$AV.push(c),l=n[++a]}s!==l?.index&&(r=ui.nextNode(),s++)}return ui.currentNode=_i,o}p(e){let i=0;for(const n of this._$AV)n!==void 0&&(n.strings!==void 0?(n._$AI(e,n,i),i+=n.strings.length-2):n._$AI(e[i])),i++}}class Ao{get _$AU(){var e;return((e=this._$AM)==null?void 0:e._$AU)??this._$Cv}constructor(e,i,n,o){this.type=2,this._$AH=ne,this._$AN=void 0,this._$AA=e,this._$AB=i,this._$AM=n,this.options=o,this._$Cv=o?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode;const i=this._$AM;return i!==void 0&&e?.nodeType===11&&(e=i.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,i=this){e=ln(this,e,i),to(e)?e===ne||e==null||e===""?(this._$AH!==ne&&this._$AR(),this._$AH=ne):e!==this._$AH&&e!==xi&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):_v(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==ne&&to(this._$AH)?this._$AA.nextSibling.data=e:this.T(_i.createTextNode(e)),this._$AH=e}$(e){var i;const{values:n,_$litType$:o}=e,r=typeof o=="number"?this._$AC(e):(o.el===void 0&&(o.el=io.createElement(yh(o.h,o.h[0]),this.options)),o);if(((i=this._$AH)==null?void 0:i._$AD)===r)this._$AH.p(n);else{const s=new Sv(r,this),a=s.u(this.options);s.p(n),this.T(a),this._$AH=s}}_$AC(e){let i=Nc.get(e.strings);return i===void 0&&Nc.set(e.strings,i=new io(e)),i}k(e){Qa(this._$AH)||(this._$AH=[],this._$AR());const i=this._$AH;let n,o=0;for(const r of e)o===i.length?i.push(n=new Ao(this.O(eo()),this.O(eo()),this,this.options)):n=i[o],n._$AI(r),o++;o<i.length&&(this._$AR(n&&n._$AB.nextSibling,o),i.length=o)}_$AR(e=this._$AA.nextSibling,i){var n;for((n=this._$AP)==null?void 0:n.call(this,!1,!0,i);e!==this._$AB;){const o=Lc(e).nextSibling;Lc(e).remove(),e=o}}setConnected(e){var i;this._$AM===void 0&&(this._$Cv=e,(i=this._$AP)==null||i.call(this,e))}}class Yr{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,i,n,o,r){this.type=1,this._$AH=ne,this._$AN=void 0,this.element=e,this.name=i,this._$AM=o,this.options=r,n.length>2||n[0]!==""||n[1]!==""?(this._$AH=Array(n.length-1).fill(new String),this.strings=n):this._$AH=ne}_$AI(e,i=this,n,o){const r=this.strings;let s=!1;if(r===void 0)e=ln(this,e,i,0),s=!to(e)||e!==this._$AH&&e!==xi,s&&(this._$AH=e);else{const a=e;let l,c;for(e=r[0],l=0;l<r.length-1;l++)c=ln(this,a[n+l],i,l),c===xi&&(c=this._$AH[l]),s||(s=!to(c)||c!==this._$AH[l]),c===ne?e=ne:e!==ne&&(e+=(c??"")+r[l+1]),this._$AH[l]=c}s&&!o&&this.j(e)}j(e){e===ne?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}}class Av extends Yr{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===ne?void 0:e}}class Cv extends Yr{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==ne)}}class kv extends Yr{constructor(e,i,n,o,r){super(e,i,n,o,r),this.type=5}_$AI(e,i=this){if((e=ln(this,e,i,0)??ne)===xi)return;const n=this._$AH,o=e===ne&&n!==ne||e.capture!==n.capture||e.once!==n.once||e.passive!==n.passive,r=e!==ne&&(n===ne||o);o&&this.element.removeEventListener(this.name,this,n),r&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){var i;typeof this._$AH=="function"?this._$AH.call(((i=this.options)==null?void 0:i.host)??this.element,e):this._$AH.handleEvent(e)}}class Tv{constructor(e,i,n){this.element=e,this.type=6,this._$AN=void 0,this._$AM=i,this.options=n}get _$AU(){return this._$AM._$AU}_$AI(e){ln(this,e)}}const Fc=pr.litHtmlPolyfillSupport;Fc?.(io,Ao),(pr.litHtmlVersions??(pr.litHtmlVersions=[])).push("3.3.2");const Ws=(t,e,i)=>{const n=i?.renderBefore??e;let o=n._$litPart$;if(o===void 0){const r=i?.renderBefore??null;n._$litPart$=o=new Ao(e.insertBefore(eo(),r),r,void 0,i??{})}return o._$AI(t),o};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const no=globalThis;let J=class extends Di{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var t;const e=super.createRenderRoot();return(t=this.renderOptions).renderBefore??(t.renderBefore=e.firstChild),e}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Ws(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return xi}};var Uc;J._$litElement$=!0,J.finalized=!0,(Uc=no.litElementHydrateSupport)==null||Uc.call(no,{LitElement:J});const Hc=no.litElementPolyfillSupport;Hc?.({LitElement:J});(no.litElementVersions??(no.litElementVersions=[])).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ov={attribute:!0,type:String,converter:hr,reflect:!1,hasChanged:Ka},Iv=(t=Ov,e,i)=>{const{kind:n,metadata:o}=i;let r=globalThis.litPropertyMetadata.get(o);if(r===void 0&&globalThis.litPropertyMetadata.set(o,r=new Map),n==="setter"&&((t=Object.create(t)).wrapped=!0),r.set(i.name,t),n==="accessor"){const{name:s}=i;return{set(a){const l=e.get.call(this);e.set.call(this,a),this.requestUpdate(s,l,t,!0,a)},init(a){return a!==void 0&&this.C(s,void 0,t,a),a}}}if(n==="setter"){const{name:s}=i;return function(a){const l=this[s];e.call(this,a),this.requestUpdate(s,l,t,!0,a)}}throw Error("Unsupported decorator location: "+n)};function x(t){return(e,i)=>typeof i=="object"?Iv(t,e,i):((n,o,r)=>{const s=o.hasOwnProperty(r);return o.constructor.createProperty(r,n),s?Object.getOwnPropertyDescriptor(o,r):void 0})(t,e,i)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function ki(t){return x({...t,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Pv=t=>t.strings===void 0;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const vh={ATTRIBUTE:1,CHILD:2},wh=t=>(...e)=>({_$litDirective$:t,values:e});let $h=class{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,e,i){this._$Ct=t,this._$AM=e,this._$Ci=i}_$AS(t,e){return this.update(t,e)}update(t,e){return this.render(...e)}};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Bn=(t,e)=>{var i;const n=t._$AN;if(n===void 0)return!1;for(const o of n)(i=o._$AO)==null||i.call(o,e,!1),Bn(o,e);return!0},mr=t=>{let e,i;do{if((e=t._$AM)===void 0)break;i=e._$AN,i.delete(t),t=e}while(i?.size===0)},_h=t=>{for(let e;e=t._$AM;t=e){let i=e._$AN;if(i===void 0)e._$AN=i=new Set;else if(i.has(t))break;i.add(t),Mv(e)}};function zv(t){this._$AN!==void 0?(mr(this),this._$AM=t,_h(this)):this._$AM=t}function Lv(t,e=!1,i=0){const n=this._$AH,o=this._$AN;if(o!==void 0&&o.size!==0)if(e)if(Array.isArray(n))for(let r=i;r<n.length;r++)Bn(n[r],!1),mr(n[r]);else n!=null&&(Bn(n,!1),mr(n));else Bn(this,t)}const Mv=t=>{t.type==vh.CHILD&&(t._$AP??(t._$AP=Lv),t._$AQ??(t._$AQ=zv))};class Dv extends $h{constructor(){super(...arguments),this._$AN=void 0}_$AT(e,i,n){super._$AT(e,i,n),_h(this),this.isConnected=e._$AU}_$AO(e,i=!0){var n,o;e!==this.isConnected&&(this.isConnected=e,e?(n=this.reconnected)==null||n.call(this):(o=this.disconnected)==null||o.call(this)),i&&(Bn(this,e),mr(this))}setValue(e){if(Pv(this._$Ct))this._$Ct._$AI(e,this);else{const i=[...this._$Ct._$AH];i[this._$Ci]=e,this._$Ct._$AI(i,this,0)}}disconnected(){}reconnected(){}}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const cn=()=>new jv;class jv{}const bs=new WeakMap,me=wh(class extends Dv{render(t){return ne}update(t,[e]){var i;const n=e!==this.G;return n&&this.G!==void 0&&this.rt(void 0),(n||this.lt!==this.ct)&&(this.G=e,this.ht=(i=t.options)==null?void 0:i.host,this.rt(this.ct=t.element)),ne}rt(t){if(this.isConnected||(t=void 0),typeof this.G=="function"){const e=this.ht??globalThis;let i=bs.get(e);i===void 0&&(i=new WeakMap,bs.set(e,i)),i.get(this.G)!==void 0&&this.G.call(this.ht,void 0),i.set(this.G,t),t!==void 0&&this.G.call(this.ht,t)}else this.G.value=t}get lt(){var t,e;return typeof this.G=="function"?(t=bs.get(this.ht??globalThis))==null?void 0:t.get(this.G):(e=this.G)==null?void 0:e.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}});/**
* (c) Iconify
*
* For the full copyright and license information, please view the license.txt
* files at https://github.com/iconify/iconify
*
* Licensed under MIT.
*
* @license MIT
* @version 2.0.0
*/const xh=Object.freeze({left:0,top:0,width:16,height:16}),br=Object.freeze({rotate:0,vFlip:!1,hFlip:!1}),Co=Object.freeze({...xh,...br}),Ys=Object.freeze({...Co,body:"",hidden:!1}),Rv=Object.freeze({width:null,height:null}),Eh=Object.freeze({...Rv,...br});function Bv(t,e=0){const i=t.replace(/^-?[0-9.]*/,"");function n(o){for(;o<0;)o+=4;return o%4}if(i===""){const o=parseInt(t);return isNaN(o)?0:n(o)}else if(i!==t){let o=0;switch(i){case"%":o=25;break;case"deg":o=90}if(o){let r=parseFloat(t.slice(0,t.length-i.length));return isNaN(r)?0:(r=r/o,r%1===0?n(r):0)}}return e}const Nv=/[\s,]+/;function Fv(t,e){e.split(Nv).forEach(i=>{switch(i.trim()){case"horizontal":t.hFlip=!0;break;case"vertical":t.vFlip=!0;break}})}const Sh={...Eh,preserveAspectRatio:""};function qc(t){const e={...Sh},i=(n,o)=>t.getAttribute(n)||o;return e.width=i("width",null),e.height=i("height",null),e.rotate=Bv(i("rotate","")),Fv(e,i("flip","")),e.preserveAspectRatio=i("preserveAspectRatio",i("preserveaspectratio","")),e}function Uv(t,e){for(const i in Sh)if(t[i]!==e[i])return!0;return!1}const Nn=/^[a-z0-9]+(-[a-z0-9]+)*$/,ko=(t,e,i,n="")=>{const o=t.split(":");if(t.slice(0,1)==="@"){if(o.length<2||o.length>3)return null;n=o.shift().slice(1)}if(o.length>3||!o.length)return null;if(o.length>1){const a=o.pop(),l=o.pop(),c={provider:o.length>0?o[0]:n,prefix:l,name:a};return e&&!Go(c)?null:c}const r=o[0],s=r.split("-");if(s.length>1){const a={provider:n,prefix:s.shift(),name:s.join("-")};return e&&!Go(a)?null:a}if(i&&n===""){const a={provider:n,prefix:"",name:r};return e&&!Go(a,i)?null:a}return null},Go=(t,e)=>t?!!((t.provider===""||t.provider.match(Nn))&&(e&&t.prefix===""||t.prefix.match(Nn))&&t.name.match(Nn)):!1;function Hv(t,e){const i={};!t.hFlip!=!e.hFlip&&(i.hFlip=!0),!t.vFlip!=!e.vFlip&&(i.vFlip=!0);const n=((t.rotate||0)+(e.rotate||0))%4;return n&&(i.rotate=n),i}function Vc(t,e){const i=Hv(t,e);for(const n in Ys)n in br?n in t&&!(n in i)&&(i[n]=br[n]):n in e?i[n]=e[n]:n in t&&(i[n]=t[n]);return i}function qv(t,e){const i=t.icons,n=t.aliases||Object.create(null),o=Object.create(null);function r(s){if(i[s])return o[s]=[];if(!(s in o)){o[s]=null;const a=n[s]&&n[s].parent,l=a&&r(a);l&&(o[s]=[a].concat(l))}return o[s]}return Object.keys(i).concat(Object.keys(n)).forEach(r),o}function Vv(t,e,i){const n=t.icons,o=t.aliases||Object.create(null);let r={};function s(a){r=Vc(n[a]||o[a],r)}return s(e),i.forEach(s),Vc(t,r)}function Ah(t,e){const i=[];if(typeof t!="object"||typeof t.icons!="object")return i;t.not_found instanceof Array&&t.not_found.forEach(o=>{e(o,null),i.push(o)});const n=qv(t);for(const o in n){const r=n[o];r&&(e(o,Vv(t,o,r)),i.push(o))}return i}const Gv={provider:"",aliases:{},not_found:{},...xh};function gs(t,e){for(const i in e)if(i in t&&typeof t[i]!=typeof e[i])return!1;return!0}function Ch(t){if(typeof t!="object"||t===null)return null;const e=t;if(typeof e.prefix!="string"||!t.icons||typeof t.icons!="object"||!gs(t,Gv))return null;const i=e.icons;for(const o in i){const r=i[o];if(!o.match(Nn)||typeof r.body!="string"||!gs(r,Ys))return null}const n=e.aliases||Object.create(null);for(const o in n){const r=n[o],s=r.parent;if(!o.match(Nn)||typeof s!="string"||!i[s]&&!n[s]||!gs(r,Ys))return null}return e}const gr=Object.create(null);function Wv(t,e){return{provider:t,prefix:e,icons:Object.create(null),missing:new Set}}function Vt(t,e){const i=gr[t]||(gr[t]=Object.create(null));return i[e]||(i[e]=Wv(t,e))}function el(t,e){return Ch(e)?Ah(e,(i,n)=>{n?t.icons[i]=n:t.missing.add(i)}):[]}function Yv(t,e,i){try{if(typeof i.body=="string")return t.icons[e]={...i},!0}catch{}return!1}function Xv(t,e){let i=[];return(typeof t=="string"?[t]:Object.keys(gr)).forEach(n=>{(typeof n=="string"&&typeof e=="string"?[e]:Object.keys(gr[n]||{})).forEach(o=>{const r=Vt(n,o);i=i.concat(Object.keys(r.icons).map(s=>(n!==""?"@"+n+":":"")+o+":"+s))})}),i}let oo=!1;function kh(t){return typeof t=="boolean"&&(oo=t),oo}function ro(t){const e=typeof t=="string"?ko(t,!0,oo):t;if(e){const i=Vt(e.provider,e.prefix),n=e.name;return i.icons[n]||(i.missing.has(n)?null:void 0)}}function Th(t,e){const i=ko(t,!0,oo);if(!i)return!1;const n=Vt(i.provider,i.prefix);return Yv(n,i.name,e)}function Gc(t,e){if(typeof t!="object")return!1;if(typeof e!="string"&&(e=t.provider||""),oo&&!e&&!t.prefix){let o=!1;return Ch(t)&&(t.prefix="",Ah(t,(r,s)=>{s&&Th(r,s)&&(o=!0)})),o}const i=t.prefix;if(!Go({provider:e,prefix:i,name:"a"}))return!1;const n=Vt(e,i);return!!el(n,t)}function Wc(t){return!!ro(t)}function Zv(t){const e=ro(t);return e?{...Co,...e}:null}function Jv(t){const e={loaded:[],missing:[],pending:[]},i=Object.create(null);t.sort((o,r)=>o.provider!==r.provider?o.provider.localeCompare(r.provider):o.prefix!==r.prefix?o.prefix.localeCompare(r.prefix):o.name.localeCompare(r.name));let n={provider:"",prefix:"",name:""};return t.forEach(o=>{if(n.name===o.name&&n.prefix===o.prefix&&n.provider===o.provider)return;n=o;const r=o.provider,s=o.prefix,a=o.name,l=i[r]||(i[r]=Object.create(null)),c=l[s]||(l[s]=Vt(r,s));let d;a in c.icons?d=e.loaded:s===""||c.missing.has(a)?d=e.missing:d=e.pending;const u={provider:r,prefix:s,name:a};d.push(u)}),e}function Oh(t,e){t.forEach(i=>{const n=i.loaderCallbacks;n&&(i.loaderCallbacks=n.filter(o=>o.id!==e))})}function Kv(t){t.pendingCallbacksFlag||(t.pendingCallbacksFlag=!0,setTimeout(()=>{t.pendingCallbacksFlag=!1;const e=t.loaderCallbacks?t.loaderCallbacks.slice(0):[];if(!e.length)return;let i=!1;const n=t.provider,o=t.prefix;e.forEach(r=>{const s=r.icons,a=s.pending.length;s.pending=s.pending.filter(l=>{if(l.prefix!==o)return!0;const c=l.name;if(t.icons[c])s.loaded.push({provider:n,prefix:o,name:c});else if(t.missing.has(c))s.missing.push({provider:n,prefix:o,name:c});else return i=!0,!0;return!1}),s.pending.length!==a&&(i||Oh([t],r.id),r.callback(s.loaded.slice(0),s.missing.slice(0),s.pending.slice(0),r.abort))})}))}let Qv=0;function e0(t,e,i){const n=Qv++,o=Oh.bind(null,i,n);if(!e.pending.length)return o;const r={id:n,icons:e,callback:t,abort:o};return i.forEach(s=>{(s.loaderCallbacks||(s.loaderCallbacks=[])).push(r)}),o}const Xs=Object.create(null);function Yc(t,e){Xs[t]=e}function Zs(t){return Xs[t]||Xs[""]}function t0(t,e=!0,i=!1){const n=[];return t.forEach(o=>{const r=typeof o=="string"?ko(o,e,i):o;r&&n.push(r)}),n}var i0={resources:[],index:0,timeout:2e3,rotate:750,random:!1,dataAfterTimeout:!1};function n0(t,e,i,n){const o=t.resources.length,r=t.random?Math.floor(Math.random()*o):t.index;let s;if(t.random){let E=t.resources.slice(0);for(s=[];E.length>1;){const O=Math.floor(Math.random()*E.length);s.push(E[O]),E=E.slice(0,O).concat(E.slice(O+1))}s=s.concat(E)}else s=t.resources.slice(r).concat(t.resources.slice(0,r));const a=Date.now();let l="pending",c=0,d,u=null,h=[],p=[];typeof n=="function"&&p.push(n);function m(){u&&(clearTimeout(u),u=null)}function g(){l==="pending"&&(l="aborted"),m(),h.forEach(E=>{E.status==="pending"&&(E.status="aborted")}),h=[]}function f(E,O){O&&(p=[]),typeof E=="function"&&p.push(E)}function v(){return{startTime:a,payload:e,status:l,queriesSent:c,queriesPending:h.length,subscribe:f,abort:g}}function b(){l="failed",p.forEach(E=>{E(void 0,d)})}function y(){h.forEach(E=>{E.status==="pending"&&(E.status="aborted")}),h=[]}function $(E,O,D){const P=O!=="success";switch(h=h.filter(T=>T!==E),l){case"pending":break;case"failed":if(P||!t.dataAfterTimeout)return;break;default:return}if(O==="abort"){d=D,b();return}if(P){d=D,h.length||(s.length?A():b());return}if(m(),y(),!t.random){const T=t.resources.indexOf(E.resource);T!==-1&&T!==t.index&&(t.index=T)}l="completed",p.forEach(T=>{T(D)})}function A(){if(l!=="pending")return;m();const E=s.shift();if(E===void 0){if(h.length){u=setTimeout(()=>{m(),l==="pending"&&(y(),b())},t.timeout);return}b();return}const O={status:"pending",resource:E,callback:(D,P)=>{$(O,D,P)}};h.push(O),c++,u=setTimeout(A,t.rotate),i(E,e,O.callback)}return setTimeout(A),v}function Ih(t){const e={...i0,...t};let i=[];function n(){i=i.filter(s=>s().status==="pending")}function o(s,a,l){const c=n0(e,s,a,(d,u)=>{n(),l&&l(d,u)});return i.push(c),c}function r(s){return i.find(a=>s(a))||null}return{query:o,find:r,setIndex:s=>{e.index=s},getIndex:()=>e.index,cleanup:n}}function tl(t){let e;if(typeof t.resources=="string")e=[t.resources];else if(e=t.resources,!(e instanceof Array)||!e.length)return null;return{resources:e,path:t.path||"/",maxURL:t.maxURL||500,rotate:t.rotate||750,timeout:t.timeout||5e3,random:t.random===!0,index:t.index||0,dataAfterTimeout:t.dataAfterTimeout!==!1}}const Xr=Object.create(null),jo=["https://api.simplesvg.com","https://api.unisvg.com"],Js=[];for(;jo.length>0;)jo.length===1||Math.random()>.5?Js.push(jo.shift()):Js.push(jo.pop());Xr[""]=tl({resources:["https://api.iconify.design"].concat(Js)});function Xc(t,e){const i=tl(e);return i===null?!1:(Xr[t]=i,!0)}function Zr(t){return Xr[t]}function o0(){return Object.keys(Xr)}function Zc(){}const ys=Object.create(null);function r0(t){if(!ys[t]){const e=Zr(t);if(!e)return;const i=Ih(e),n={config:e,redundancy:i};ys[t]=n}return ys[t]}function Ph(t,e,i){let n,o;if(typeof t=="string"){const r=Zs(t);if(!r)return i(void 0,424),Zc;o=r.send;const s=r0(t);s&&(n=s.redundancy)}else{const r=tl(t);if(r){n=Ih(r);const s=t.resources?t.resources[0]:"",a=Zs(s);a&&(o=a.send)}}return!n||!o?(i(void 0,424),Zc):n.query(e,o,i)().abort}const Jc="iconify2",so="iconify",zh=so+"-count",Kc=so+"-version",Lh=36e5,s0=168,a0=50;function Ks(t,e){try{return t.getItem(e)}catch{}}function il(t,e,i){try{return t.setItem(e,i),!0}catch{}}function Qc(t,e){try{t.removeItem(e)}catch{}}function Qs(t,e){return il(t,zh,e.toString())}function ea(t){return parseInt(Ks(t,zh))||0}const mi={local:!0,session:!0},Mh={local:new Set,session:new Set};let nl=!1;function l0(t){nl=t}let Ro=typeof window>"u"?{}:window;function Dh(t){const e=t+"Storage";try{if(Ro&&Ro[e]&&typeof Ro[e].length=="number")return Ro[e]}catch{}mi[t]=!1}function jh(t,e){const i=Dh(t);if(!i)return;const n=Ks(i,Kc);if(n!==Jc){if(n){const a=ea(i);for(let l=0;l<a;l++)Qc(i,so+l.toString())}il(i,Kc,Jc),Qs(i,0);return}const o=Math.floor(Date.now()/Lh)-s0,r=a=>{const l=so+a.toString(),c=Ks(i,l);if(typeof c=="string"){try{const d=JSON.parse(c);if(typeof d=="object"&&typeof d.cached=="number"&&d.cached>o&&typeof d.provider=="string"&&typeof d.data=="object"&&typeof d.data.prefix=="string"&&e(d,a))return!0}catch{}Qc(i,l)}};let s=ea(i);for(let a=s-1;a>=0;a--)r(a)||(a===s-1?(s--,Qs(i,s)):Mh[t].add(a))}function Rh(){if(!nl){l0(!0);for(const t in mi)jh(t,e=>{const i=e.data,n=e.provider,o=i.prefix,r=Vt(n,o);if(!el(r,i).length)return!1;const s=i.lastModified||-1;return r.lastModifiedCached=r.lastModifiedCached?Math.min(r.lastModifiedCached,s):s,!0})}}function c0(t,e){const i=t.lastModifiedCached;if(i&&i>=e)return i===e;if(t.lastModifiedCached=e,i)for(const n in mi)jh(n,o=>{const r=o.data;return o.provider!==t.provider||r.prefix!==t.prefix||r.lastModified===e});return!0}function d0(t,e){nl||Rh();function i(n){let o;if(!mi[n]||!(o=Dh(n)))return;const r=Mh[n];let s;if(r.size)r.delete(s=Array.from(r).shift());else if(s=ea(o),s>=a0||!Qs(o,s+1))return;const a={cached:Math.floor(Date.now()/Lh),provider:t.provider,data:e};return il(o,so+s.toString(),JSON.stringify(a))}e.lastModified&&!c0(t,e.lastModified)||Object.keys(e.icons).length&&(e.not_found&&(e=Object.assign({},e),delete e.not_found),i("local")||i("session"))}function ed(){}function u0(t){t.iconsLoaderFlag||(t.iconsLoaderFlag=!0,setTimeout(()=>{t.iconsLoaderFlag=!1,Kv(t)}))}function h0(t,e){t.iconsToLoad?t.iconsToLoad=t.iconsToLoad.concat(e).sort():t.iconsToLoad=e,t.iconsQueueFlag||(t.iconsQueueFlag=!0,setTimeout(()=>{t.iconsQueueFlag=!1;const{provider:i,prefix:n}=t,o=t.iconsToLoad;delete t.iconsToLoad;let r;!o||!(r=Zs(i))||r.prepare(i,n,o).forEach(s=>{Ph(i,s,a=>{if(typeof a!="object")s.icons.forEach(l=>{t.missing.add(l)});else try{const l=el(t,a);if(!l.length)return;const c=t.pendingIcons;c&&l.forEach(d=>{c.delete(d)}),d0(t,a)}catch(l){console.error(l)}u0(t)})})}))}const ol=(t,e)=>{const i=t0(t,!0,kh()),n=Jv(i);if(!n.pending.length){let l=!0;return e&&setTimeout(()=>{l&&e(n.loaded,n.missing,n.pending,ed)}),()=>{l=!1}}const o=Object.create(null),r=[];let s,a;return n.pending.forEach(l=>{const{provider:c,prefix:d}=l;if(d===a&&c===s)return;s=c,a=d,r.push(Vt(c,d));const u=o[c]||(o[c]=Object.create(null));u[d]||(u[d]=[])}),n.pending.forEach(l=>{const{provider:c,prefix:d,name:u}=l,h=Vt(c,d),p=h.pendingIcons||(h.pendingIcons=new Set);p.has(u)||(p.add(u),o[c][d].push(u))}),r.forEach(l=>{const{provider:c,prefix:d}=l;o[c][d].length&&h0(l,o[c][d])}),e?e0(e,n,r):ed},p0=t=>new Promise((e,i)=>{const n=typeof t=="string"?ko(t,!0):t;if(!n){i(t);return}ol([n||t],o=>{if(o.length&&n){const r=ro(n);if(r){e({...Co,...r});return}}i(t)})});function f0(t){try{const e=typeof t=="string"?JSON.parse(t):t;if(typeof e.body=="string")return{...e}}catch{}}function m0(t,e){const i=typeof t=="string"?ko(t,!0,!0):null;if(!i){const r=f0(t);return{value:t,data:r}}const n=ro(i);if(n!==void 0||!i.prefix)return{value:t,name:i,data:n};const o=ol([i],()=>e(t,i,ro(i)));return{value:t,name:i,loading:o}}function vs(t){return t.hasAttribute("inline")}let Bh=!1;try{Bh=navigator.vendor.indexOf("Apple")===0}catch{}function b0(t,e){switch(e){case"svg":case"bg":case"mask":return e}return e!=="style"&&(Bh||t.indexOf("<a")===-1)?"svg":t.indexOf("currentColor")===-1?"bg":"mask"}const g0=/(-?[0-9.]*[0-9]+[0-9.]*)/g,y0=/^-?[0-9.]*[0-9]+[0-9.]*$/g;function ta(t,e,i){if(e===1)return t;if(i=i||100,typeof t=="number")return Math.ceil(t*e*i)/i;if(typeof t!="string")return t;const n=t.split(g0);if(n===null||!n.length)return t;const o=[];let r=n.shift(),s=y0.test(r);for(;;){if(s){const a=parseFloat(r);isNaN(a)?o.push(r):o.push(Math.ceil(a*e*i)/i)}else o.push(r);if(r=n.shift(),r===void 0)return o.join("");s=!s}}function v0(t,e="defs"){let i="";const n=t.indexOf("<"+e);for(;n>=0;){const o=t.indexOf(">",n),r=t.indexOf("</"+e);if(o===-1||r===-1)break;const s=t.indexOf(">",r);if(s===-1)break;i+=t.slice(o+1,r).trim(),t=t.slice(0,n).trim()+t.slice(s+1)}return{defs:i,content:t}}function w0(t,e){return t?"<defs>"+t+"</defs>"+e:e}function $0(t,e,i){const n=v0(t);return w0(n.defs,e+n.content+i)}const _0=t=>t==="unset"||t==="undefined"||t==="none";function Nh(t,e){const i={...Co,...t},n={...Eh,...e},o={left:i.left,top:i.top,width:i.width,height:i.height};let r=i.body;[i,n].forEach(g=>{const f=[],v=g.hFlip,b=g.vFlip;let y=g.rotate;v?b?y+=2:(f.push("translate("+(o.width+o.left).toString()+" "+(0-o.top).toString()+")"),f.push("scale(-1 1)"),o.top=o.left=0):b&&(f.push("translate("+(0-o.left).toString()+" "+(o.height+o.top).toString()+")"),f.push("scale(1 -1)"),o.top=o.left=0);let $;switch(y<0&&(y-=Math.floor(y/4)*4),y=y%4,y){case 1:$=o.height/2+o.top,f.unshift("rotate(90 "+$.toString()+" "+$.toString()+")");break;case 2:f.unshift("rotate(180 "+(o.width/2+o.left).toString()+" "+(o.height/2+o.top).toString()+")");break;case 3:$=o.width/2+o.left,f.unshift("rotate(-90 "+$.toString()+" "+$.toString()+")");break}y%2===1&&(o.left!==o.top&&($=o.left,o.left=o.top,o.top=$),o.width!==o.height&&($=o.width,o.width=o.height,o.height=$)),f.length&&(r=$0(r,'<g transform="'+f.join(" ")+'">',"</g>"))});const s=n.width,a=n.height,l=o.width,c=o.height;let d,u;s===null?(u=a===null?"1em":a==="auto"?c:a,d=ta(u,l/c)):(d=s==="auto"?l:s,u=a===null?ta(d,c/l):a==="auto"?c:a);const h={},p=(g,f)=>{_0(f)||(h[g]=f.toString())};p("width",d),p("height",u);const m=[o.left,o.top,l,c];return h.viewBox=m.join(" "),{attributes:h,viewBox:m,body:r}}function rl(t,e){let i=t.indexOf("xlink:")===-1?"":' xmlns:xlink="http://www.w3.org/1999/xlink"';for(const n in e)i+=" "+n+'="'+e[n]+'"';return'<svg xmlns="http://www.w3.org/2000/svg"'+i+">"+t+"</svg>"}function x0(t){return t.replace(/"/g,"'").replace(/%/g,"%25").replace(/#/g,"%23").replace(/</g,"%3C").replace(/>/g,"%3E").replace(/\s+/g," ")}function E0(t){return"data:image/svg+xml,"+x0(t)}function Fh(t){return'url("'+E0(t)+'")'}const S0=()=>{let t;try{if(t=fetch,typeof t=="function")return t}catch{}};let yr=S0();function A0(t){yr=t}function C0(){return yr}function k0(t,e){const i=Zr(t);if(!i)return 0;let n;if(!i.maxURL)n=0;else{let o=0;i.resources.forEach(s=>{o=Math.max(o,s.length)});const r=e+".json?icons=";n=i.maxURL-o-i.path.length-r.length}return n}function T0(t){return t===404}const O0=(t,e,i)=>{const n=[],o=k0(t,e),r="icons";let s={type:r,provider:t,prefix:e,icons:[]},a=0;return i.forEach((l,c)=>{a+=l.length+1,a>=o&&c>0&&(n.push(s),s={type:r,provider:t,prefix:e,icons:[]},a=l.length),s.icons.push(l)}),n.push(s),n};function I0(t){if(typeof t=="string"){const e=Zr(t);if(e)return e.path}return"/"}const P0=(t,e,i)=>{if(!yr){i("abort",424);return}let n=I0(e.provider);switch(e.type){case"icons":{const r=e.prefix,s=e.icons.join(","),a=new URLSearchParams({icons:s});n+=r+".json?"+a.toString();break}case"custom":{const r=e.uri;n+=r.slice(0,1)==="/"?r.slice(1):r;break}default:i("abort",400);return}let o=503;yr(t+n).then(r=>{const s=r.status;if(s!==200){setTimeout(()=>{i(T0(s)?"abort":"next",s)});return}return o=501,r.json()}).then(r=>{if(typeof r!="object"||r===null){setTimeout(()=>{r===404?i("abort",r):i("next",o)});return}setTimeout(()=>{i("success",r)})}).catch(()=>{i("next",o)})},z0={prepare:O0,send:P0};function td(t,e){switch(t){case"local":case"session":mi[t]=e;break;case"all":for(const i in mi)mi[i]=e;break}}const ws="data-style";let Uh="";function L0(t){Uh=t}function id(t,e){let i=Array.from(t.childNodes).find(n=>n.hasAttribute&&n.hasAttribute(ws));i||(i=document.createElement("style"),i.setAttribute(ws,ws),t.appendChild(i)),i.textContent=":host{display:inline-block;vertical-align:"+(e?"-0.125em":"0")+"}span,svg{display:block}"+Uh}function Hh(){Yc("",z0),kh(!0);let t;try{t=window}catch{}if(t){if(Rh(),t.IconifyPreload!==void 0){const e=t.IconifyPreload,i="Invalid IconifyPreload syntax.";typeof e=="object"&&e!==null&&(e instanceof Array?e:[e]).forEach(n=>{try{(typeof n!="object"||n===null||n instanceof Array||typeof n.icons!="object"||typeof n.prefix!="string"||!Gc(n))&&console.error(i)}catch{console.error(i)}})}if(t.IconifyProviders!==void 0){const e=t.IconifyProviders;if(typeof e=="object"&&e!==null)for(const i in e){const n="IconifyProviders["+i+"] is invalid.";try{const o=e[i];if(typeof o!="object"||!o||o.resources===void 0)continue;Xc(i,o)||console.error(n)}catch{console.error(n)}}}}return{enableCache:e=>td(e,!0),disableCache:e=>td(e,!1),iconLoaded:Wc,iconExists:Wc,getIcon:Zv,listIcons:Xv,addIcon:Th,addCollection:Gc,calculateSize:ta,buildIcon:Nh,iconToHTML:rl,svgToURL:Fh,loadIcons:ol,loadIcon:p0,addAPIProvider:Xc,appendCustomStyle:L0,_api:{getAPIConfig:Zr,setAPIModule:Yc,sendAPIQuery:Ph,setFetch:A0,getFetch:C0,listAPIProviders:o0}}}const ia={"background-color":"currentColor"},qh={"background-color":"transparent"},nd={image:"var(--svg)",repeat:"no-repeat",size:"100% 100%"},od={"-webkit-mask":ia,mask:ia,background:qh};for(const t in od){const e=od[t];for(const i in nd)e[t+"-"+i]=nd[i]}function rd(t){return t?t+(t.match(/^[-0-9.]+$/)?"px":""):"inherit"}function M0(t,e,i){const n=document.createElement("span");let o=t.body;o.indexOf("<a")!==-1&&(o+="<!-- "+Date.now()+" -->");const r=t.attributes,s=rl(o,{...r,width:e.width+"",height:e.height+""}),a=Fh(s),l=n.style,c={"--svg":a,width:rd(r.width),height:rd(r.height),...i?ia:qh};for(const d in c)l.setProperty(d,c[d]);return n}let Fn;function D0(){try{Fn=window.trustedTypes.createPolicy("iconify",{createHTML:t=>t})}catch{Fn=null}}function j0(t){return Fn===void 0&&D0(),Fn?Fn.createHTML(t):t}function R0(t){const e=document.createElement("span"),i=t.attributes;let n="";i.width||(n="width: inherit;"),i.height||(n+="height: inherit;"),n&&(i.style=n);const o=rl(t.body,i);return e.innerHTML=j0(o),e.firstChild}function na(t){return Array.from(t.childNodes).find(e=>{const i=e.tagName&&e.tagName.toUpperCase();return i==="SPAN"||i==="SVG"})}function sd(t,e){const i=e.icon.data,n=e.customisations,o=Nh(i,n);n.preserveAspectRatio&&(o.attributes.preserveAspectRatio=n.preserveAspectRatio);const r=e.renderedMode;let s;switch(r){case"svg":s=R0(o);break;default:s=M0(o,{...Co,...i},r==="mask")}const a=na(t);a?s.tagName==="SPAN"&&a.tagName===s.tagName?a.setAttribute("style",s.getAttribute("style")):t.replaceChild(s,a):t.appendChild(s)}function ad(t,e,i){const n=i&&(i.rendered?i:i.lastRender);return{rendered:!1,inline:e,icon:t,lastRender:n}}function B0(t="iconify-icon"){let e,i;try{e=window.customElements,i=window.HTMLElement}catch{return}if(!e||!i)return;const n=e.get(t);if(n)return n;const o=["icon","mode","inline","observe","width","height","rotate","flip"],r=class extends i{constructor(){super(),si(this,"_shadowRoot"),si(this,"_initialised",!1),si(this,"_state"),si(this,"_checkQueued",!1),si(this,"_connected",!1),si(this,"_observer",null),si(this,"_visible",!0);const a=this._shadowRoot=this.attachShadow({mode:"open"}),l=vs(this);id(a,l),this._state=ad({value:""},l),this._queueCheck()}connectedCallback(){this._connected=!0,this.startObserver()}disconnectedCallback(){this._connected=!1,this.stopObserver()}static get observedAttributes(){return o.slice(0)}attributeChangedCallback(a){switch(a){case"inline":{const l=vs(this),c=this._state;l!==c.inline&&(c.inline=l,id(this._shadowRoot,l));break}case"observer":{this.observer?this.startObserver():this.stopObserver();break}default:this._queueCheck()}}get icon(){const a=this.getAttribute("icon");if(a&&a.slice(0,1)==="{")try{return JSON.parse(a)}catch{}return a}set icon(a){typeof a=="object"&&(a=JSON.stringify(a)),this.setAttribute("icon",a)}get inline(){return vs(this)}set inline(a){a?this.setAttribute("inline","true"):this.removeAttribute("inline")}get observer(){return this.hasAttribute("observer")}set observer(a){a?this.setAttribute("observer","true"):this.removeAttribute("observer")}restartAnimation(){const a=this._state;if(a.rendered){const l=this._shadowRoot;if(a.renderedMode==="svg")try{l.lastChild.setCurrentTime(0);return}catch{}sd(l,a)}}get status(){const a=this._state;return a.rendered?"rendered":a.icon.data===null?"failed":"loading"}_queueCheck(){this._checkQueued||(this._checkQueued=!0,setTimeout(()=>{this._check()}))}_check(){if(!this._checkQueued)return;this._checkQueued=!1;const a=this._state,l=this.getAttribute("icon");if(l!==a.icon.value){this._iconChanged(l);return}if(!a.rendered||!this._visible)return;const c=this.getAttribute("mode"),d=qc(this);(a.attrMode!==c||Uv(a.customisations,d)||!na(this._shadowRoot))&&this._renderIcon(a.icon,d,c)}_iconChanged(a){const l=m0(a,(c,d,u)=>{const h=this._state;if(h.rendered||this.getAttribute("icon")!==c)return;const p={value:c,name:d,data:u};p.data?this._gotIconData(p):h.icon=p});l.data?this._gotIconData(l):this._state=ad(l,this._state.inline,this._state)}_forceRender(){if(!this._visible){const a=na(this._shadowRoot);a&&this._shadowRoot.removeChild(a);return}this._queueCheck()}_gotIconData(a){this._checkQueued=!1,this._renderIcon(a,qc(this),this.getAttribute("mode"))}_renderIcon(a,l,c){const d=b0(a.data.body,c),u=this._state.inline;sd(this._shadowRoot,this._state={rendered:!0,icon:a,inline:u,customisations:l,attrMode:c,renderedMode:d})}startObserver(){if(!this._observer)try{this._observer=new IntersectionObserver(a=>{const l=a.some(c=>c.isIntersecting);l!==this._visible&&(this._visible=l,this._forceRender())}),this._observer.observe(this)}catch{if(this._observer){try{this._observer.disconnect()}catch{}this._observer=null}}}stopObserver(){this._observer&&(this._observer.disconnect(),this._observer=null,this._visible=!0,this._connected&&this._forceRender())}};o.forEach(a=>{a in r.prototype||Object.defineProperty(r.prototype,a,{get:function(){return this.getAttribute(a)},set:function(l){l!==null?this.setAttribute(a,l):this.removeAttribute(a)}})});const s=Hh();for(const a in s)r[a]=r.prototype[a]=s[a];return e.define(t,r),r}const N0=B0()||Hh(),{enableCache:gx,disableCache:yx,iconLoaded:vx,iconExists:wx,getIcon:$x,listIcons:_x,addIcon:xx,addCollection:F0,calculateSize:Ex,buildIcon:Sx,iconToHTML:Ax,svgToURL:Cx,loadIcons:U0,loadIcon:kx,addAPIProvider:Tx,_api:Ox}=N0,H0=ee`
  ::-webkit-scrollbar {
    width: 0.4rem;
    height: 0.4rem;
    overflow: hidden;
  }

  ::-webkit-scrollbar-thumb {
    border-radius: 0.25rem;
    background-color: var(
      --bim-scrollbar--c,
      color-mix(in lab, var(--bim-ui_main-base), white 15%)
    );
  }

  ::-webkit-scrollbar-track {
    background-color: var(--bim-scrollbar--bgc, var(--bim-ui_bg-base));
  }
`,q0=ee`
  :root {
    /* Grayscale Colors */
    --bim-ui_gray-0: hsl(210 10% 5%);
    --bim-ui_gray-1: hsl(210 10% 10%);
    --bim-ui_gray-2: hsl(210 10% 20%);
    --bim-ui_gray-3: hsl(210 10% 30%);
    --bim-ui_gray-4: hsl(210 10% 40%);
    --bim-ui_gray-5: hsl(210 10% 50%);
    --bim-ui_gray-6: hsl(210 10% 60%);
    --bim-ui_gray-7: hsl(210 10% 70%);
    --bim-ui_gray-8: hsl(210 10% 80%);
    --bim-ui_gray-9: hsl(210 10% 90%);
    --bim-ui_gray-10: hsl(210 10% 95%);

    /* Brand Colors */
    --bim-ui_main-base: #6528d7;
    --bim-ui_accent-base: #bcf124;

    /* Brand Colors Contrasts */
    --bim-ui_main-contrast: var(--bim-ui_gray-10);
    --bim-ui_accent-contrast: var(--bim-ui_gray-0);

    /* Sizes */
    --bim-ui_size-4xs: 0.375rem;
    --bim-ui_size-3xs: 0.5rem;
    --bim-ui_size-2xs: 0.625rem;
    --bim-ui_size-xs: 0.75rem;
    --bim-ui_size-sm: 0.875rem;
    --bim-ui_size-base: 1rem;
    --bim-ui_size-lg: 1.125rem;
    --bim-ui_size-xl: 1.25rem;
    --bim-ui_size-2xl: 1.375rem;
    --bim-ui_size-3xl: 1.5rem;
    --bim-ui_size-4xl: 1.625rem;
    --bim-ui_size-5xl: 1.75rem;
    --bim-ui_size-6xl: 1.875rem;
    --bim-ui_size-7xl: 2rem;
    --bim-ui_size-8xl: 2.125rem;
    --bim-ui_size-9xl: 2.25rem;
  }

  /* Background Colors */
  @media (prefers-color-scheme: dark) {
    :root {
      --bim-ui_bg-base: var(--bim-ui_gray-0);
      --bim-ui_bg-contrast-10: var(--bim-ui_gray-1);
      --bim-ui_bg-contrast-20: var(--bim-ui_gray-2);
      --bim-ui_bg-contrast-30: var(--bim-ui_gray-3);
      --bim-ui_bg-contrast-40: var(--bim-ui_gray-4);
      --bim-ui_bg-contrast-60: var(--bim-ui_gray-6);
      --bim-ui_bg-contrast-80: var(--bim-ui_gray-8);
      --bim-ui_bg-contrast-100: var(--bim-ui_gray-10);
    }
  }

  @media (prefers-color-scheme: light) {
    :root {
      --bim-ui_bg-base: var(--bim-ui_gray-10);
      --bim-ui_bg-contrast-10: var(--bim-ui_gray-9);
      --bim-ui_bg-contrast-20: var(--bim-ui_gray-8);
      --bim-ui_bg-contrast-30: var(--bim-ui_gray-7);
      --bim-ui_bg-contrast-40: var(--bim-ui_gray-6);
      --bim-ui_bg-contrast-60: var(--bim-ui_gray-4);
      --bim-ui_bg-contrast-80: var(--bim-ui_gray-2);
      --bim-ui_bg-contrast-100: var(--bim-ui_gray-0);
      --bim-ui_accent-base: #6528d7;
    }
  }

  .theme-transition-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    filter: drop-shadow(0 0 10px var(--bim-ui_bg-base));
    z-index: 9999;
  }

  .theme-transition-overlay > div {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--bim-ui_bg-base);
  }

  html.bim-ui-dark {
    --bim-ui_bg-base: var(--bim-ui_gray-0);
    --bim-ui_bg-contrast-10: var(--bim-ui_gray-1);
    --bim-ui_bg-contrast-20: var(--bim-ui_gray-2);
    --bim-ui_bg-contrast-30: var(--bim-ui_gray-3);
    --bim-ui_bg-contrast-40: var(--bim-ui_gray-4);
    --bim-ui_bg-contrast-60: var(--bim-ui_gray-6);
    --bim-ui_bg-contrast-80: var(--bim-ui_gray-8);
    --bim-ui_bg-contrast-100: var(--bim-ui_gray-10);
  }

  html.bim-ui-light {
    --bim-ui_bg-base: var(--bim-ui_gray-10);
    --bim-ui_bg-contrast-10: var(--bim-ui_gray-9);
    --bim-ui_bg-contrast-20: var(--bim-ui_gray-8);
    --bim-ui_bg-contrast-30: var(--bim-ui_gray-7);
    --bim-ui_bg-contrast-40: var(--bim-ui_gray-6);
    --bim-ui_bg-contrast-60: var(--bim-ui_gray-4);
    --bim-ui_bg-contrast-80: var(--bim-ui_gray-2);
    --bim-ui_bg-contrast-100: var(--bim-ui_gray-0);
    --bim-ui_accent-base: #6528d7;
  }

  @keyframes toggleOverlay {
    0%,
    99% {
      display: block;
    }

    100% {
      display: none;
    }
  }

  @keyframes toggleThemeAnimation {
    0% {
      clip-path: circle(0% at center top);
    }
    45%,
    55% {
      clip-path: circle(150% at center center);
    }
    100% {
      clip-path: circle(0% at center bottom);
    }
  }

  [data-context-dialog]::backdrop {
    background-color: transparent;
  }
`,Qt={scrollbar:H0,globalStyles:q0},Vh=class W{static set config(e){this._config={...W._config,...e}}static get config(){return W._config}static addGlobalStyles(){let e=document.querySelector("style[id='bim-ui']");if(e)return;e=document.createElement("style"),e.id="bim-ui",e.textContent=Qt.globalStyles.cssText;const i=document.head.firstChild;i?document.head.insertBefore(e,i):document.head.append(e)}static preloadIcons(e,i=!1){U0(e,(n,o,r)=>{i&&(console.log("Icons loaded:",n),o.length&&console.warn("Icons missing:",o),r.length&&console.info("Icons pending:",r))})}static addIconsCollection(e,i){F0({prefix:i?.prefix??"bim",icons:e,width:24,height:24})}static defineCustomElement(e,i){customElements.get(e)||customElements.define(e,i)}static registerComponents(){W.init()}static init(e="",i=!0){W.addGlobalStyles(),W.defineCustomElement("bim-button",Z0),W.defineCustomElement("bim-checkbox",wn),W.defineCustomElement("bim-color-input",ei),W.defineCustomElement("bim-context-menu",Un),W.defineCustomElement("bim-dropdown",lt),W.defineCustomElement("bim-grid",al),W.defineCustomElement("bim-icon",ow),W.defineCustomElement("bim-input",Oo),W.defineCustomElement("bim-label",$n),W.defineCustomElement("bim-number-input",Ue),W.defineCustomElement("bim-option",he),W.defineCustomElement("bim-panel",Oi),W.defineCustomElement("bim-panel-section",_n),W.defineCustomElement("bim-selector",xn),W.defineCustomElement("bim-table",He),W.defineCustomElement("bim-tabs",It),W.defineCustomElement("bim-tab",Pe),W.defineCustomElement("bim-table-cell",sp),W.defineCustomElement("bim-table-children",gw),W.defineCustomElement("bim-table-group",dp),W.defineCustomElement("bim-table-row",Ii),W.defineCustomElement("bim-text-input",Oe),W.defineCustomElement("bim-toolbar",is),W.defineCustomElement("bim-toolbar-group",es),W.defineCustomElement("bim-toolbar-section",An),W.defineCustomElement("bim-viewport",$p),W.defineCustomElement("bim-tooltip",Bw),i&&this.animateOnLoad(e)}static newRandomId(){const e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";let i="";for(let n=0;n<10;n++){const o=Math.floor(Math.random()*e.length);i+=e.charAt(o)}return i}static animateOnLoad(e=""){const i=`
      bim-input,
      bim-button,
      bim-checkbox,
      bim-selector,
      bim-label,
      bim-table-row,
      bim-panel-section,
      bim-table-children .branch-vertical,
      .switchers
    `,n=[];function o(r,s=document,a=new Set){const l=[];return Array.from(s.querySelectorAll(r)).forEach(c=>{a.has(c)||(a.add(c),l.push(c))}),Array.from(s.querySelectorAll("*")).filter(c=>c.shadowRoot).forEach(c=>{a.has(c)||(a.add(c),l.push(...o(r,c.shadowRoot,a)))}),l}requestAnimationFrame(()=>{o(e||i).forEach(s=>{const a=s;let l="auto";l=window.getComputedStyle(a).getPropertyValue("transition"),a.style.setProperty("opacity","0"),a.style.setProperty("transition","none"),requestAnimationFrame(()=>{a.style.setProperty("transition",l)}),n.push(a)});const r=()=>{n.forEach(s=>{const a=s,l=(a.getBoundingClientRect().x+a.getBoundingClientRect().y)/(window.innerWidth+window.innerHeight),c=window.getComputedStyle(a).getPropertyValue("transform"),d=400,u=200+l*1e3;a.animate([{transform:"translateY(-20px)",opacity:"0"},{transform:"translateY(0)",opacity:"1"}],{duration:d,easing:"ease-in-out",delay:u}),setTimeout(()=>{a.style.removeProperty("opacity"),c!=="none"?a.style.setProperty("transform",c):a.style.removeProperty("transform")},u+d)})};document.readyState==="complete"?r():window.addEventListener("load",r)})}static toggleTheme(e=!0){const i=document.querySelector("html");if(!i)return;const n=()=>{i.classList.contains("bim-ui-dark")?i.classList.replace("bim-ui-dark","bim-ui-light"):i.classList.contains("bim-ui-light")?i.classList.replace("bim-ui-light","bim-ui-dark"):i.classList.add("bim-ui-light")};if(e){const o=document.createElement("div");o.classList.add("theme-transition-overlay");const r=document.createElement("div");o.appendChild(r),r.style.setProperty("transition",`background-color ${1e3/3200}s`),document.body.appendChild(o),o.style.setProperty("animation",`toggleOverlay ${1e3/1e3}s ease-in forwards`),r.style.setProperty("animation",`toggleThemeAnimation ${1e3/1e3}s ease forwards`),setTimeout(()=>{n()},1e3/4),setTimeout(()=>{document.body.querySelectorAll(".theme-transition-overlay").forEach(s=>{document.body.removeChild(s)})},1e3)}else n()}};Vh._config={sectionLabelOnVerticalToolbar:!1};let Re=Vh;class be extends J{constructor(){super(...arguments),this._lazyLoadObserver=null,this._visibleElements=[],this.ELEMENTS_BEFORE_OBSERVER=20,this.useObserver=!1,this.elements=new Set,this.observe=e=>{if(!this.useObserver)return;for(const n of e)this.elements.add(n);const i=e.slice(this.ELEMENTS_BEFORE_OBSERVER);for(const n of i)n.remove();this.observeLastElement()}}set visibleElements(e){this._visibleElements=this.useObserver?e:[],this.requestUpdate()}get visibleElements(){return this._visibleElements}getLazyObserver(){if(!this.useObserver)return null;if(this._lazyLoadObserver)return this._lazyLoadObserver;const e=new IntersectionObserver(i=>{const n=i[0];if(!n.isIntersecting)return;const o=n.target;e.unobserve(o);const r=this.ELEMENTS_BEFORE_OBSERVER+this.visibleElements.length,s=[...this.elements][r];s&&(this.visibleElements=[...this.visibleElements,s],e.observe(s))},{threshold:.5});return e}observeLastElement(){const e=this.getLazyObserver();if(!e)return;const i=this.ELEMENTS_BEFORE_OBSERVER+this.visibleElements.length-1,n=[...this.elements][i];n&&e.observe(n)}resetVisibleElements(){const e=this.getLazyObserver();if(e){for(const i of this.elements)e.unobserve(i);this.visibleElements=[],this.observeLastElement()}}static create(e,i){const n=document.createDocumentFragment();if(e.length===0)return Ws(e(),n),n.firstElementChild;if(!i)throw new Error("UIComponent: Initial state is required for statefull components.");let o=i;const r=e,s=l=>(o={...o,...l},Ws(r(o,s),n),o);s(i);const a=()=>o;return[n.firstElementChild,s,a]}}const ao=(t,e={},i=!0)=>{let n={};for(const o of t.children){const r=o,s=r.getAttribute("name")||r.getAttribute("label"),a=s?e[s]:void 0;if(s){if("value"in r&&typeof r.value<"u"&&r.value!==null){const l=r.value;if(typeof l=="object"&&!Array.isArray(l)&&Object.keys(l).length===0)continue;n[s]=a?a(r.value):r.value}else if(i){const l=ao(r,e);if(Object.keys(l).length===0)continue;n[s]=a?a(l):l}}else i&&(n={...n,...ao(r,e)})}return n},Jr=t=>t==="true"||t==="false"?t==="true":t&&!isNaN(Number(t))&&t.trim()!==""?Number(t):t,V0=[">=","<=","=",">","<","?","/","#"];function ld(t){const e=V0.find(s=>t.split(s).length===2),i=t.split(e).map(s=>s.trim()),[n,o]=i,r=o.startsWith("'")&&o.endsWith("'")?o.replace(/'/g,""):Jr(o);return{key:n,condition:e,value:r}}const oa=t=>{try{const e=[],i=t.split(/&(?![^()]*\))/).map(n=>n.trim());for(const n of i){const o=!n.startsWith("(")&&!n.endsWith(")"),r=n.startsWith("(")&&n.endsWith(")");if(o){const s=ld(n);e.push(s)}if(r){const s={operator:"&",queries:n.replace(/^(\()|(\))$/g,"").split("&").map(a=>a.trim()).map((a,l)=>{const c=ld(a);return l>0&&(c.operator="&"),c})};e.push(s)}}return e}catch{return null}},cd=(t,e,i)=>{let n=!1;switch(e){case"=":n=t===i;break;case"?":n=String(t).includes(String(i));break;case"<":(typeof t=="number"||typeof i=="number")&&(n=t<i);break;case"<=":(typeof t=="number"||typeof i=="number")&&(n=t<=i);break;case">":(typeof t=="number"||typeof i=="number")&&(n=t>i);break;case">=":(typeof t=="number"||typeof i=="number")&&(n=t>=i);break;case"/":n=String(t).startsWith(String(i));break}return n};var G0=Object.defineProperty,W0=Object.getOwnPropertyDescriptor,Gh=(t,e,i,n)=>{for(var o=W0(e,i),r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&G0(e,i,o),o},xe;const sl=(xe=class extends J{constructor(){super(...arguments),this._previousContainer=null,this._visible=!1}get placement(){return this._placement}set placement(t){this._placement=t,this.updatePosition()}static removeMenus(){for(const t of[...xe.dialog.children])t instanceof xe&&(t.remove(),t.visible=!1);setTimeout(()=>{xe.dialog.close(),xe.dialog.remove()},310)}get visible(){return this._visible}set visible(t){this._visible=t,t?(xe.dialog.parentElement||document.body.append(xe.dialog),this._previousContainer=this.parentElement,xe.dialog.style.top=`${window.scrollY||document.documentElement.scrollTop}px`,this.style.setProperty("display","flex"),xe.dialog.append(this),xe.dialog.showModal(),this.updatePosition(),this.dispatchEvent(new Event("visible"))):setTimeout(()=>{var e;(e=this._previousContainer)==null||e.append(this),this._previousContainer=null,this.style.setProperty("display","none"),this.dispatchEvent(new Event("hidden"))},310)}async updatePosition(){if(!(this.visible&&this._previousContainer))return;const t=this.placement??"right",e=await Xa(this._previousContainer,this,{placement:t,middleware:[Ha(10),Ya(),Wa(),Ga({padding:5})]}),{x:i,y:n}=e;this.style.left=`${i}px`,this.style.top=`${n}px`}connectedCallback(){super.connectedCallback(),this.visible?(this.style.setProperty("width","auto"),this.style.setProperty("height","auto")):(this.style.setProperty("display","none"),this.style.setProperty("width","0"),this.style.setProperty("height","0"))}render(){return w` <slot></slot> `}},xe.styles=[Qt.scrollbar,ee`
      :host {
        pointer-events: auto;
        position: absolute;
        top: 0;
        left: 0;
        z-index: 999;
        overflow: auto;
        max-height: 20rem;
        min-width: 3rem;
        flex-direction: column;
        box-shadow: 1px 2px 8px 2px rgba(0, 0, 0, 0.15);
        padding: 0.5rem;
        border-radius: var(--bim-ui_size-4xs);
        display: flex;
        transform-origin: top left;
        transform: scale(1);
        clip-path: circle(150% at top left);
        background-color: var(--bim-ui_bg-contrast-20);
        transition:
          clip-path 0.2s cubic-bezier(0.72, 0.1, 0.43, 0.93),
          transform 0.3s cubic-bezier(0.72, 0.1, 0.45, 2.35);
      }

      :host(:not([visible])) {
        transform: scale(0.8);
        clip-path: circle(0 at top left);
      }
    `],xe.dialog=be.create(()=>w` <dialog
      @click=${t=>{t.target===xe.dialog&&xe.removeMenus()}}
      @cancel=${()=>xe.removeMenus()}
      data-context-dialog
      style="
      width: 0;
      height: 0;
      position: relative;
      padding: 0;
      border: none;
      outline: none;
      margin: none;
      overflow: visible;
      background-color: transparent;
    "
    ></dialog>`),xe);Gh([x({type:String,reflect:!0})],sl.prototype,"placement");Gh([x({type:Boolean,reflect:!0})],sl.prototype,"visible");let Un=sl;var Y0=Object.defineProperty,X0=Object.getOwnPropertyDescriptor,at=(t,e,i,n)=>{for(var o=n>1?void 0:n?X0(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&Y0(e,i,o),o},In;const Je=(In=class extends J{constructor(){super(),this.labelHidden=!1,this.active=!1,this.disabled=!1,this.vertical=!1,this.tooltipVisible=!1,this._stateBeforeLoading={disabled:!1,icon:""},this._loading=!1,this._parent=cn(),this._tooltip=cn(),this._mouseLeave=!1,this.onClick=t=>{t.stopPropagation(),this.disabled||this.dispatchEvent(new Event("click"))},this.showContextMenu=()=>{let t=this._contextMenu;if(this.contextMenuTemplate&&(t=be.create(()=>{const e=be.create(this.contextMenuTemplate);return e instanceof Un?w`${e}`:w`
          <bim-context-menu>${e}</bim-context-menu>
        `}),this.append(t),t.addEventListener("hidden",()=>{t?.remove()})),t){const e=this.getAttribute("data-context-group");e&&t.setAttribute("data-context-group",e),this.closeNestedContexts();const i=Re.newRandomId();for(const n of t.children)n instanceof In&&n.setAttribute("data-context-group",i);t.visible=!0}},this.mouseLeave=!0}set loading(t){if(this._loading=t,t)this._stateBeforeLoading={disabled:this.disabled,icon:this.icon},this.disabled=t,this.icon="eos-icons:loading";else{const{disabled:e,icon:i}=this._stateBeforeLoading;this.disabled=e,this.icon=i}}get loading(){return this._loading}set mouseLeave(t){this._mouseLeave=t,t&&(this.tooltipVisible=!1,clearTimeout(this.timeoutID))}get mouseLeave(){return this._mouseLeave}computeTooltipPosition(){const{value:t}=this._parent,{value:e}=this._tooltip;t&&e&&Xa(t,e,{placement:"bottom",middleware:[Ha(10),Ya(),Wa(),Ga({padding:5})]}).then(i=>{const{x:n,y:o}=i;Object.assign(e.style,{left:`${n}px`,top:`${o}px`})})}onMouseEnter(){if(!(this.tooltipTitle||this.tooltipText))return;this.mouseLeave=!1;const t=this.tooltipTime??700;this.timeoutID=setTimeout(()=>{this.mouseLeave||(this.computeTooltipPosition(),this.tooltipVisible=!0)},t)}closeNestedContexts(){const t=this.getAttribute("data-context-group");if(t)for(const e of Un.dialog.children){const i=e.getAttribute("data-context-group");if(e instanceof Un&&i===t){e.visible=!1,e.removeAttribute("data-context-group");for(const n of e.children)n instanceof In&&(n.closeNestedContexts(),n.removeAttribute("data-context-group"))}}}click(){this.disabled||super.click()}get _contextMenu(){return this.querySelector("bim-context-menu")}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this.showContextMenu)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("click",this.showContextMenu)}render(){const t=w`
      <div ${me(this._tooltip)} class="tooltip">
        ${this.tooltipTitle?w`<p style="text-wrap: nowrap;">
              <strong>${this.tooltipTitle}</strong>
            </p>`:null}
        ${this.tooltipText?w`<p style="width: 9rem;">${this.tooltipText}</p>`:null}
      </div>
    `;let e=w`${this.label}`;if((this._contextMenu||this.contextMenuTemplate)&&this.label){const i=w`<svg
        xmlns="http://www.w3.org/2000/svg"
        height="1.125rem"
        viewBox="0 0 24 24"
        width="1.125rem"
        style="fill: var(--bim-label--c)"
      >
        <path d="M0 0h24v24H0V0z" fill="none" />
        <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
      </svg>`;e=w`
        <div style="display: flex; align-items: center;">
          ${this.label}
          ${i}
        </div>
      `}return w`
      <div ${me(this._parent)} class="parent" @click=${this.onClick}>
        ${this.label||this.icon?w`
              <div
                class="button"
                @mouseenter=${this.onMouseEnter}
                @mouseleave=${()=>this.mouseLeave=!0}
              >
                <bim-label
                  .icon=${this.icon}
                  .vertical=${this.vertical}
                  .labelHidden=${this.labelHidden}
                  >${e}</bim-label
                >
              </div>
            `:null}
        ${this.tooltipTitle||this.tooltipText?t:null}
      </div>
      <slot></slot>
    `}},In.styles=ee`
    :host {
      --bim-label--c: var(--bim-ui_bg-contrast-100, white);
      position: relative;
      display: block;
      flex: 1;
      pointer-events: none;
      background-color: var(--bim-button--bgc, var(--bim-ui_bg-contrast-20));
      border-radius: var(--bim-ui_size-4xs);
      transition: all 0.15s;
    }

    :host(:not([disabled]))::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      background-color: var(--bim-ui_main-base);
      clip-path: circle(0 at center center);
      box-sizing: border-box;
      transition:
        clip-path 0.3s cubic-bezier(0.65, 0.05, 0.36, 1),
        transform 0.15s;
    }

    :host(:not([disabled]):hover) {
      cursor: pointer;
    }

    bim-label {
      pointer-events: none;
    }

    .parent {
      --bim-icon--c: var(--bim-label--c);
      position: relative;
      display: flex;
      height: 100%;
      user-select: none;
      row-gap: 0.125rem;
      min-height: var(--bim-ui_size-5xl);
      min-width: var(--bim-ui_size-5xl);
    }

    .button,
    .children {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
    }

    .children {
      padding: 0 0.375rem;
      position: absolute;
      height: 100%;
      right: 0;
    }

    :host(:not([label-hidden])[icon][vertical]) .parent {
      min-height: 2.5rem;
    }

    .button {
      flex-grow: 1;
      transition: transform 0.15s;
    }

    :host(:not([label-hidden])[label]) .button {
      justify-content: var(--bim-button--jc, center);
    }

    :host(:hover)::before {
      clip-path: circle(120% at center center);
    }

    :host(:hover) {
      --bim-label--c: var(--bim-ui_main-contrast);
      z-index: 2;
    }

    :host([active]) {
      background-color: var(--bim-ui_main-base);
    }

    :host(:not([disabled]):active) {
      background: transparent;
    }

    :host(:not([disabled]):active) .button,
    :host(:not([disabled]):active)::before {
      transform: scale(0.98);
    }

    :host(:not([label]):not([icon])) .children {
      flex: 1;
    }

    :host([vertical]) .parent {
      justify-content: center;
    }

    :host(:not([label-hidden])[label]) .button {
      padding: 0 0.5rem;
    }

    :host([disabled]) {
      --bim-label--c: var(--bim-ui_bg-contrast-80) !important;
      background-color: gray !important;
    }

    ::slotted(bim-button) {
      --bim-icon--fz: var(--bim-ui_size-base);
      --bim-button--bdrs: var(--bim-ui_size-4xs);
      --bim-button--olw: 0;
      --bim-button--olc: transparent;
    }

    .tooltip {
      position: absolute;
      padding: 0.75rem;
      z-index: 99;
      display: flex;
      flex-flow: column;
      row-gap: 0.375rem;
      box-shadow: 0 0 10px 3px rgba(0 0 0 / 20%);
      outline: 1px solid var(--bim-ui_bg-contrast-40);
      font-size: var(--bim-ui_size-xs);
      border-radius: var(--bim-ui_size-4xs);
      background-color: var(--bim-ui_bg-contrast-20);
      color: var(--bim-ui_bg-contrast-100);
      animation: openTooltips 0.15s ease-out forwards;
      transition: visibility 0.2s;
    }

    .tooltip p {
      margin: 0;
      padding: 0;
    }

    :host(:not([tooltip-visible])) .tooltip {
      animation: closeTooltips 0.15s ease-in forwards;
      visibility: hidden;
      display: none;
    }

    @keyframes closeTooltips {
      0% {
        display: flex;
        padding: 0.75rem;
        transform: translateY(0);
        opacity: 1;
      }
      90% {
        padding: 0.75rem;
      }
      100% {
        display: none;
        padding: 0;
        transform: translateY(-10px);
        opacity: 0;
      }
    }

    @keyframes openTooltips {
      0% {
        display: flex;
        transform: translateY(-10px);
        opacity: 0;
      }
      100% {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `,In);at([x({type:String,reflect:!0})],Je.prototype,"label",2);at([x({type:Boolean,attribute:"label-hidden",reflect:!0})],Je.prototype,"labelHidden",2);at([x({type:Boolean,reflect:!0})],Je.prototype,"active",2);at([x({type:Boolean,reflect:!0,attribute:"disabled"})],Je.prototype,"disabled",2);at([x({type:String,reflect:!0})],Je.prototype,"icon",2);at([x({type:Boolean,reflect:!0})],Je.prototype,"vertical",2);at([x({type:Number,attribute:"tooltip-time",reflect:!0})],Je.prototype,"tooltipTime",2);at([x({type:Boolean,attribute:"tooltip-visible",reflect:!0})],Je.prototype,"tooltipVisible",2);at([x({type:String,attribute:"tooltip-title",reflect:!0})],Je.prototype,"tooltipTitle",2);at([x({type:String,attribute:"tooltip-text",reflect:!0})],Je.prototype,"tooltipText",2);at([x({type:Boolean,reflect:!0})],Je.prototype,"loading",1);let Z0=Je;var J0=Object.defineProperty,To=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&J0(e,i,o),o};const Wh=class extends J{constructor(){super(...arguments),this.checked=!1,this.inverted=!1,this.onValueChange=new Event("change")}get value(){return this.checked}onChange(t){t.stopPropagation(),this.checked=t.target.checked,this.dispatchEvent(this.onValueChange)}render(){const t=w`
      <svg viewBox="0 0 21 21">
        <polyline points="5 10.75 8.5 14.25 16 6"></polyline>
      </svg>
    `;return w`
      <div class="parent">
        <label class="parent-label">
          ${this.label?w`<bim-label .icon="${this.icon}">${this.label}</bim-label> `:null}
          <div class="input-container">
            <input
              type="checkbox"
              aria-label=${this.label||this.name||"Checkbox Input"}
              @change="${this.onChange}"
              .checked="${this.checked}"
            />
            ${t}
          </div>
        </label>
      </div>
    `}};Wh.styles=ee`
    :host {
      display: block;
    }

    .parent-label {
      --background: #fff;
      --border: #dfdfe6;
      --stroke: #fff;
      --border-hover: var(--bim-ui_main-base);
      --border-active: var(--bim-ui_main-base);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      width: 100%;
      height: 1.75rem;
      column-gap: 0.25rem;
      position: relative;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    }

    :host([inverted]) .parent-label {
      flex-direction: row-reverse;
      justify-content: start;
    }

    input,
    svg {
      width: 1rem;
      height: 1rem;
      display: block;
    }

    input {
      -webkit-appearance: none;
      -moz-appearance: none;
      position: relative;
      outline: none;
      background: var(--background);
      border: none;
      margin: 0;
      padding: 0;
      cursor: pointer;
      border-radius: 4px;
      transition: box-shadow 0.3s;
      box-shadow: inset 0 0 0 var(--s, 1px) var(--b, var(--border));
    }

    svg {
      pointer-events: none;
      fill: none;
      stroke-width: 2.2px;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke: var(--stroke, var(--border-active));
      transform: translateY(-100%) scale(0);
      position: absolute;
      width: 1rem;
      height: 1rem;
    }

    input:hover {
      --s: 2px;
      --b: var(--border-hover);
    }

    input:checked {
      --b: var(--border-active);
      --s: 11px;
    }

    input:checked + svg {
      -webkit-animation: bounce 0.4s linear forwards 0.2s;
      animation: bounce 0.4s linear forwards 0.2s;
    }

    @keyframes bounce {
      0% {
        transform: translateY(-100%) scale(0);
      }
      50% {
        transform: translateY(-100%) scale(1.2);
      }
      75% {
        transform: translateY(-100%) scale(0.9);
      }
      100% {
        transform: translateY(-100%) scale(1);
      }
    }
  `;let wn=Wh;To([x({type:String,reflect:!0})],wn.prototype,"icon");To([x({type:String,reflect:!0})],wn.prototype,"name");To([x({type:String,reflect:!0})],wn.prototype,"label");To([x({type:Boolean,reflect:!0})],wn.prototype,"checked");To([x({type:Boolean,reflect:!0})],wn.prototype,"inverted");var K0=Object.defineProperty,Ti=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&K0(e,i,o),o};const Yh=class extends J{constructor(){super(...arguments),this.vertical=!1,this.color="#bcf124",this.disabled=!1,this._colorInput=cn(),this._textInput=cn(),this.onValueChange=new Event("input"),this.onOpacityInput=t=>{const e=t.target;this.opacity=e.value,this.dispatchEvent(this.onValueChange)}}set value(t){const{color:e,opacity:i}=t;this.color=e,i&&(this.opacity=i)}get value(){const t={color:this.color};return this.opacity&&(t.opacity=this.opacity),t}onColorInput(t){t.stopPropagation();const{value:e}=this._colorInput;e&&(this.color=e.value,this.dispatchEvent(this.onValueChange))}onTextInput(t){t.stopPropagation();const{value:e}=this._textInput;if(!e)return;const{value:i}=e;let n=i.replace(/[^a-fA-F0-9]/g,"");n.startsWith("#")||(n=`#${n}`),e.value=n.slice(0,7),e.value.length===7&&(this.color=e.value,this.dispatchEvent(this.onValueChange))}focus(){const{value:t}=this._colorInput;t&&t.click()}render(){return w`
      <div class="parent">
        <bim-input
          .label=${this.label}
          .icon=${this.icon}
          .vertical="${this.vertical}"
        >
          <div class="color-container">
            <div
              style="display: flex; align-items: center; gap: .375rem; height: 100%; flex: 1; padding: 0 0.5rem;"
            >
              <input
                ${me(this._colorInput)}
                @input="${this.onColorInput}"
                type="color"
                aria-label=${this.label||this.name||"Color Input"}
                value="${this.color}"
                ?disabled=${this.disabled}
              />
              <div
                @click=${this.focus}
                class="sample"
                style="background-color: ${this.color}"
              ></div>
              <input
                ${me(this._textInput)}
                @input="${this.onTextInput}"
                value="${this.color}"
                type="text"
                aria-label=${this.label||this.name||"Text Color Input"}
                ?disabled=${this.disabled}
              />
            </div>
            ${this.opacity!==void 0?w`<bim-number-input
                  @change=${this.onOpacityInput}
                  slider
                  suffix="%"
                  min="0"
                  value=${this.opacity}
                  max="100"
                ></bim-number-input>`:null}
          </div>
        </bim-input>
      </div>
    `}};Yh.styles=ee`
    :host {
      --bim-input--bgc: var(--bim-ui_bg-contrast-20);
      flex: 1;
      display: block;
    }

    :host(:focus) {
      --bim-input--olw: var(--bim-number-input--olw, 2px);
      --bim-input--olc: var(--bim-ui_accent-base);
    }

    .parent {
      display: flex;
      gap: 0.375rem;
    }

    .color-container {
      position: relative;
      outline: none;
      display: flex;
      height: 100%;
      gap: 0.5rem;
      justify-content: flex-start;
      align-items: center;
      flex: 1;
      border-radius: var(--bim-color-input--bdrs, var(--bim-ui_size-4xs));
    }

    .color-container input[type="color"] {
      position: absolute;
      bottom: -0.25rem;
      visibility: hidden;
      width: 0;
      height: 0;
    }

    .color-container .sample {
      width: 1rem;
      height: 1rem;
      border-radius: 0.125rem;
      background-color: #fff;
    }

    .color-container input[type="text"] {
      height: 100%;
      flex: 1;
      width: 3.25rem;
      text-transform: uppercase;
      font-size: 0.75rem;
      background-color: transparent;
      padding: 0%;
      outline: none;
      border: none;
      color: var(--bim-color-input--c, var(--bim-ui_bg-contrast-100));
    }

    :host([disabled]) .color-container input[type="text"] {
      color: var(--bim-ui_bg-contrast-60);
    }

    bim-number-input {
      flex-grow: 0;
    }
  `;let ei=Yh;Ti([x({type:String,reflect:!0})],ei.prototype,"name");Ti([x({type:String,reflect:!0})],ei.prototype,"label");Ti([x({type:String,reflect:!0})],ei.prototype,"icon");Ti([x({type:Boolean,reflect:!0})],ei.prototype,"vertical");Ti([x({type:Number,reflect:!0})],ei.prototype,"opacity");Ti([x({type:String,reflect:!0})],ei.prototype,"color");Ti([x({type:Boolean,reflect:!0})],ei.prototype,"disabled");var Q0=Object.defineProperty,ew=Object.getOwnPropertyDescriptor,ti=(t,e,i,n)=>{for(var o=n>1?void 0:n?ew(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&Q0(e,i,o),o};const Xh=class extends J{constructor(){super(...arguments),this.checked=!1,this.checkbox=!1,this.noMark=!1,this.vertical=!1}get value(){return this._value!==void 0?this._value:this.label?Jr(this.label):this.label}set value(t){this._value=t}render(){return w`
      <div class="parent" .title=${this.label??""}>
        ${this.img||this.icon||this.label?w` <div style="display: flex; column-gap: 0.375rem">
              ${this.checkbox&&!this.noMark?w`<bim-checkbox
                    style="pointer-events: none"
                    .checked=${this.checked}
                  ></bim-checkbox>`:null}
              <bim-label
                .vertical=${this.vertical}
                .icon=${this.icon}
                .img=${this.img}
                >${this.label}</bim-label
              >
            </div>`:null}
        ${!this.checkbox&&!this.noMark&&this.checked?w`<svg
              xmlns="http://www.w3.org/2000/svg"
              height="1.125rem"
              viewBox="0 0 24 24"
              width="1.125rem"
              fill="#FFFFFF"
            >
              <path d="M0 0h24v24H0z" fill="none" />
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>`:null}
        <slot></slot>
      </div>
    `}};Xh.styles=ee`
    :host {
      --bim-label--c: var(--bim-ui_bg-contrast-100);
      display: block;
      box-sizing: border-box;
      flex: 1;
      padding: 0rem 0.5rem;
      border-radius: var(--bim-ui_size-4xs);
      transition: all 0.15s;
    }

    :host(:hover) {
      cursor: pointer;
    }

    :host([checked]) {
      --bim-label--c: color-mix(in lab, var(--bim-ui_main-base), white 30%);
    }

    :host([checked]) svg {
      fill: color-mix(in lab, var(--bim-ui_main-base), white 30%);
    }

    .parent {
      box-sizing: border-box;
      display: flex;
      justify-content: var(--bim-option--jc, space-between);
      column-gap: 0.5rem;
      align-items: center;
      min-height: 1.75rem;
      height: 100%;
    }

    input {
      height: 1rem;
      width: 1rem;
      cursor: pointer;
      border: none;
      outline: none;
      accent-color: var(--bim-checkbox--c, var(--bim-ui_main-base));
    }

    input:focus {
      outline: var(--bim-checkbox--olw, 2px) solid
        var(--bim-checkbox--olc, var(--bim-ui_accent-base));
    }

    bim-label {
      pointer-events: none;
      z-index: 1;
    }
  `;let he=Xh;ti([x({type:String,reflect:!0})],he.prototype,"img",2);ti([x({type:String,reflect:!0})],he.prototype,"label",2);ti([x({type:String,reflect:!0})],he.prototype,"icon",2);ti([x({type:Boolean,reflect:!0})],he.prototype,"checked",2);ti([x({type:Boolean,reflect:!0})],he.prototype,"checkbox",2);ti([x({type:Boolean,attribute:"no-mark",reflect:!0})],he.prototype,"noMark",2);ti([x({converter:{fromAttribute(t){return t&&Jr(t)}}})],he.prototype,"value",1);ti([x({type:Boolean,reflect:!0})],he.prototype,"vertical",2);var tw=Object.defineProperty,iw=Object.getOwnPropertyDescriptor,vt=(t,e,i,n)=>{for(var o=n>1?void 0:n?iw(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&tw(e,i,o),o};const Zh=class extends be{constructor(){super(),this.multiple=!1,this.required=!1,this.vertical=!1,this._visible=!1,this._value=new Set,this.onValueChange=new Event("change"),this._contextMenu=cn(),this.onOptionClick=t=>{const e=t.target,i=this._value.has(e);if(!this.multiple&&!this.required&&!i)this._value=new Set([e]);else if(!this.multiple&&!this.required&&i)this._value=new Set([]);else if(!this.multiple&&this.required&&!i)this._value=new Set([e]);else if(this.multiple&&!this.required&&!i)this._value=new Set([...this._value,e]);else if(this.multiple&&!this.required&&i){const n=[...this._value].filter(o=>o!==e);this._value=new Set(n)}else if(this.multiple&&this.required&&!i)this._value=new Set([...this._value,e]);else if(this.multiple&&this.required&&i){const n=[...this._value].filter(r=>r!==e),o=new Set(n);o.size!==0&&(this._value=o)}this.updateOptionsState(),this.dispatchEvent(this.onValueChange)},this.onSearch=({target:t})=>{const e=t.value.toLowerCase();for(const i of this._options)i instanceof he&&((i.label||i.value||"").toLowerCase().includes(e)?i.style.display="":i.style.display="none")},this.useObserver=!0}set visible(t){var e;if(t){const{value:i}=this._contextMenu;if(!i)return;for(const n of this.elements)i.append(n);this._visible=!0}else{for(const n of this.elements)this.append(n);this._visible=!1,this.resetVisibleElements();for(const n of this._options)n instanceof he&&(n.style.display="");const i=(e=this._contextMenu.value)==null?void 0:e.querySelector("bim-text-input");i&&(i.value="")}}get visible(){return this._visible}set value(t){if(this.required&&Object.keys(t).length===0)return;const e=new Set;for(const i of t){const n=this.findOption(i);if(n&&(e.add(n),!this.multiple&&Object.keys(t).length===1))break}this._value=e,this.updateOptionsState(),this.dispatchEvent(this.onValueChange)}get value(){return[...this._value].filter(t=>t instanceof he&&t.checked).map(t=>t.value)}get _options(){const t=new Set([...this.elements]);for(const e of this.children)e instanceof he&&t.add(e);return[...t]}onSlotChange(t){const e=t.target.assignedElements();this.observe(e);const i=new Set;for(const n of this.elements){if(!(n instanceof he)){n.remove();continue}n.checked&&i.add(n),n.removeEventListener("click",this.onOptionClick),n.addEventListener("click",this.onOptionClick)}this._value=i}updateOptionsState(){for(const t of this._options)t instanceof he&&(t.checked=this._value.has(t))}findOption(t){return this._options.find(e=>e instanceof he?e.label===t||e.value===t:!1)}render(){let t,e,i;if(this._value.size===0)t=this.placeholder??"Select an option...";else if(this._value.size===1){const n=[...this._value][0];t=n?.label||n?.value,e=n?.img,i=n?.icon}else t=`Multiple (${this._value.size})`;return w`
      <bim-input
        title=${this.label??""}
        .label=${this.label}
        .icon=${this.icon}
        .vertical=${this.vertical}
      >
        <div class="input" @click=${()=>this.visible=!this.visible}>
          <bim-label
            .img=${e}
            .icon=${i}
            style="overflow: hidden;"
            >${t}</bim-label
          >
          <svg
            style="flex-shrink: 0; fill: var(--bim-dropdown--c, var(--bim-ui_bg-contrast-100))"
            xmlns="http://www.w3.org/2000/svg"
            height="1.125rem"
            viewBox="0 0 24 24"
            width="1.125rem"
            fill="#9ca3af"
          >
            <path d="M0 0h24v24H0V0z" fill="none" />
            <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
          </svg>
          <bim-context-menu
            ${me(this._contextMenu)}
            .visible=${this.visible}
            @hidden=${()=>{this.visible&&(this.visible=!1)}}
          >
            ${this.searchBox?w`<bim-text-input @input=${this.onSearch} placeholder="Search..." debounce=200 style="--bim-input--bgc: var(--bim-ui_bg-contrast-30)"></bim-text-input>`:ne}
            <slot @slotchange=${this.onSlotChange}></slot>
          </bim-context-menu>
        </div>
      </bim-input>
    `}};Zh.styles=[Qt.scrollbar,ee`
      :host {
        --bim-input--bgc: var(
          --bim-dropdown--bgc,
          var(--bim-ui_bg-contrast-20)
        );
        --bim-input--olw: 2px;
        --bim-input--olc: transparent;
        --bim-input--bdrs: var(--bim-ui_size-4xs);
        flex: 1;
        display: block;
      }

      :host([visible]) {
        --bim-input--olc: var(--bim-ui_accent-base);
      }

      .input {
        --bim-label--fz: var(--bim-drodown--fz, var(--bim-ui_size-xs));
        --bim-label--c: var(--bim-dropdown--c, var(--bim-ui_bg-contrast-100));
        height: 100%;
        display: flex;
        flex: 1;
        overflow: hidden;
        column-gap: 0.25rem;
        outline: none;
        cursor: pointer;
        align-items: center;
        justify-content: space-between;
        padding: 0 0.5rem;
      }

      bim-label {
        pointer-events: none;
      }
    `];let lt=Zh;vt([x({type:String,reflect:!0})],lt.prototype,"name",2);vt([x({type:String,reflect:!0})],lt.prototype,"icon",2);vt([x({type:String,reflect:!0})],lt.prototype,"label",2);vt([x({type:Boolean,reflect:!0})],lt.prototype,"multiple",2);vt([x({type:Boolean,reflect:!0})],lt.prototype,"required",2);vt([x({type:Boolean,reflect:!0})],lt.prototype,"vertical",2);vt([x({type:String,reflect:!0})],lt.prototype,"placeholder",2);vt([x({type:Boolean,reflect:!0,attribute:"search-box"})],lt.prototype,"searchBox",2);vt([x({type:Boolean,reflect:!0})],lt.prototype,"visible",1);vt([ki()],lt.prototype,"_value",2);var nw=Object.defineProperty,Jh=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&nw(e,i,o),o};const Kh=class extends J{constructor(){super(...arguments),this.floating=!1,this._layouts={},this._elements={},this._templateIds=new Map,this._updateFunctions={},this._slotNames={notAllowed:"not-allowed",notFound:"not-found",emptyLayout:"empty-layout"},this.updateComponent={},this.emitLayoutChange=()=>{this.dispatchEvent(new Event("layoutchange"))}}set layouts(t){this._layouts=t,this._templateIds.clear()}get layouts(){return this._layouts}set elements(t){this._elements=t,this.setUpdateFunctions()}get elements(){return this._elements}getLayoutAreas(t){const{template:e}=t,i=e.split(`
`).map(n=>n.trim()).map(n=>n.split('"')[1]).filter(n=>n!==void 0).flatMap(n=>n.split(/\s+/));return[...new Set(i)].filter(n=>n!=="")}setUpdateFunctions(){const t={};for(const[e,i]of Object.entries(this.elements))"template"in i&&(t[e]=n=>{var o,r;(r=(o=this._updateFunctions)[e])==null||r.call(o,n)});this.updateComponent=t}disconnectedCallback(){super.disconnectedCallback(),this._templateIds.clear(),this._updateFunctions={},this.updateComponent={}}getTemplateId(t){let e=this._templateIds.get(t);return e||(e=Re.newRandomId(),this._templateIds.set(t,e)),e}cleanUpdateFunctions(){if(!this.layout){this._updateFunctions={};return}const t=this.layouts[this.layout],e=this.getLayoutAreas(t);for(const i in this.elements)e.includes(i)||delete this._updateFunctions[i]}clean(){this.style.gridTemplate="";for(const t of[...this.children])Object.values(this._slotNames).some(e=>t.getAttribute("slot")===e)||t.remove();this.cleanUpdateFunctions()}emitElementCreation(t){this.dispatchEvent(new CustomEvent("elementcreated",{detail:t}))}render(){if(this.layout){const t=this.layouts[this.layout];if(t){if(!(t.guard??(()=>!0))())return this.clean(),w`<slot name=${this._slotNames.notAllowed}></slot>`;const e=this.getLayoutAreas(t).map(i=>{var n;const o=((n=t.elements)==null?void 0:n[i])||this.elements[i];if(!o)return null;if(o instanceof HTMLElement)return o.style.gridArea=i,o;if("template"in o){const{template:l,initialState:c}=o,d=this.getTemplateId(l),u=this.querySelector(`[data-grid-template-id="${d}"]`);if(u)return u;const[h,p]=be.create(l,c);return this.emitElementCreation({name:i,element:h}),h.setAttribute("data-grid-template-id",d),h.style.gridArea=i,this._updateFunctions[i]=p,h}const r=this.getTemplateId(o),s=this.querySelector(`[data-grid-template-id="${r}"]`);if(s)return s;const a=be.create(o);return this.emitElementCreation({name:i,element:a}),a.setAttribute("data-grid-template-id",this.getTemplateId(o)),a.style.gridArea=i,a}).filter(i=>i!==null);this.clean(),this.style.gridTemplate=t.template,this.append(...e),this.emitLayoutChange()}else return this.clean(),w`<slot name=${this._slotNames.notFound}></slot>`}else return this.clean(),this.emitLayoutChange(),w`<slot name=${this._slotNames.emptyLayout}></slot>`;return w`${w`<slot></slot>`}`}};Kh.styles=ee`
    :host {
      display: grid;
      height: 100%;
      width: 100%;
      overflow: hidden;
      box-sizing: border-box;
    }

    /* :host(:not([layout])) {
      display: none;
    } */

    :host([floating]) {
      --bim-panel--bdrs: var(--bim-ui_size-4xs);
      background-color: transparent;
      padding: 1rem;
      gap: 1rem;
      position: absolute;
      pointer-events: none;
      top: 0px;
      left: 0px;
    }

    :host(:not([floating])) {
      --bim-panel--bdrs: 0;
      background-color: var(--bim-ui_bg-contrast-20);
      gap: 1px;
    }
  `;let al=Kh;Jh([x({type:Boolean,reflect:!0})],al.prototype,"floating");Jh([x({type:String,reflect:!0})],al.prototype,"layout");const ra=class extends J{render(){return w`
      <iconify-icon .icon=${this.icon} height="none"></iconify-icon>
    `}};ra.styles=ee`
    :host {
      height: var(--bim-icon--fz, var(--bim-ui_size-sm));
      width: var(--bim-icon--fz, var(--bim-ui_size-sm));
    }

    iconify-icon {
      height: var(--bim-icon--fz, var(--bim-ui_size-sm));
      width: var(--bim-icon--fz, var(--bim-ui_size-sm));
      color: var(--bim-icon--c);
      transition: all 0.15s;
      display: flex;
    }
  `,ra.properties={icon:{type:String}};let ow=ra;var rw=Object.defineProperty,Kr=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&rw(e,i,o),o};const Qh=class extends J{constructor(){super(...arguments),this.vertical=!1,this.onValueChange=new Event("change")}get value(){const t={};for(const e of this.children){const i=e;"value"in i?t[i.name||i.label]=i.value:"checked"in i&&(t[i.name||i.label]=i.checked)}return t}set value(t){const e=[...this.children];for(const i in t){const n=e.find(s=>{const a=s;return a.name===i||a.label===i});if(!n)continue;const o=n,r=t[i];typeof r=="boolean"?o.checked=r:o.value=r}}render(){return w`
      <div class="parent">
        ${this.label||this.icon?w`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
        <div class="input">
          <slot></slot>
        </div>
      </div>
    `}};Qh.styles=ee`
    :host {
      flex: 1;
      display: block;
    }

    .parent {
      display: flex;
      flex-wrap: wrap;
      column-gap: 1rem;
      row-gap: 0.375rem;
      user-select: none;
      flex: 1;
    }

    :host(:not([vertical])) .parent {
      justify-content: space-between;
    }

    :host([vertical]) .parent {
      flex-direction: column;
    }

    .input {
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      min-height: 1.75rem;
      min-width: 3rem;
      gap: var(--bim-input--g, var(--bim-ui_size-4xs));
      padding: var(--bim-input--p, 0);
      background-color: var(--bim-input--bgc, transparent);
      border: var(--bim-input--olw, 2px) solid
        var(--bim-input--olc, transparent);
      border-radius: var(--bim-input--bdrs, var(--bim-ui_size-4xs));
      transition: all 0.15s;
    }

    :host(:not([vertical])) .input {
      flex: 1;
      justify-content: flex-end;
    }

    :host(:not([vertical])[label]) .input {
      max-width: fit-content;
    }
  `;let Oo=Qh;Kr([x({type:String,reflect:!0})],Oo.prototype,"name");Kr([x({type:String,reflect:!0})],Oo.prototype,"label");Kr([x({type:String,reflect:!0})],Oo.prototype,"icon");Kr([x({type:Boolean,reflect:!0})],Oo.prototype,"vertical");/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function Hi(t,e,i){return t?e(t):i?.(t)}/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const sa=t=>t??ne;var sw=Object.defineProperty,Io=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&sw(e,i,o),o};const ep=class extends J{constructor(){super(...arguments),this.labelHidden=!1,this.iconHidden=!1,this.vertical=!1,this._imgTemplate=()=>w`<img src=${sa(this.img)} .alt=${this.textContent||""} />`,this._iconTemplate=()=>w`<bim-icon .icon=${this.icon}></bim-icon>`}get value(){return this.textContent?Jr(this.textContent):this.textContent}render(){return w`
      <div class="parent" title=${this.textContent}>
        ${Hi(this.img,this._imgTemplate,()=>ne)}
        ${Hi(!this.iconHidden&&this.icon,this._iconTemplate,()=>ne)}
        <p><slot></slot></p>
      </div>
    `}};ep.styles=ee`
    :host {
      --bim-icon--c: var(--bim-label--ic);
      overflow: auto;
      color: var(--bim-label--c, var(--bim-ui_bg-contrast-60));
      font-size: var(--bim-label--fz, var(--bim-ui_size-xs));
      display: block;
      white-space: nowrap;
      transition: all 0.15s;
    }

    :host([icon]) {
      line-height: 1.1rem;
    }

    .parent {
      display: flex;
      align-items: center;
      column-gap: 0.25rem;
      row-gap: 0.125rem;
      user-select: none;
      height: 100%;
    }

    :host([vertical]) .parent {
      flex-direction: column;
    }

    .parent p {
      margin: 0;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    :host([label-hidden]) .parent p,
    :host(:empty) .parent p {
      display: none;
    }

    img {
      height: 100%;
      aspect-ratio: 1;
      border-radius: 100%;
      margin-right: 0.125rem;
    }

    :host(:not([vertical])) img {
      max-height: var(
        --bim-label_icon--sz,
        calc(var(--bim-label--fz, var(--bim-ui_size-xs)) * 1.8)
      );
    }

    :host([vertical]) img {
      max-height: var(
        --bim-label_icon--sz,
        calc(var(--bim-label--fz, var(--bim-ui_size-xs)) * 4)
      );
    }
  `;let $n=ep;Io([x({type:String,reflect:!0})],$n.prototype,"img");Io([x({type:Boolean,attribute:"label-hidden",reflect:!0})],$n.prototype,"labelHidden");Io([x({type:String,reflect:!0})],$n.prototype,"icon");Io([x({type:Boolean,attribute:"icon-hidden",reflect:!0})],$n.prototype,"iconHidden");Io([x({type:Boolean,reflect:!0})],$n.prototype,"vertical");var aw=Object.defineProperty,lw=Object.getOwnPropertyDescriptor,Ke=(t,e,i,n)=>{for(var o=n>1?void 0:n?lw(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&aw(e,i,o),o};const tp=class extends J{constructor(){super(...arguments),this._value=0,this.vertical=!1,this.slider=!1,this._input=cn(),this.onValueChange=new Event("change")}set value(t){this.setValue(t.toString())}get value(){return this._value}onChange(t){t.stopPropagation();const{value:e}=this._input;e&&this.setValue(e.value)}setValue(t){const{value:e}=this._input;let i=t;if(i=i.replace(/[^0-9.-]/g,""),i=i.replace(/(\..*)\./g,"$1"),i.endsWith(".")||(i.lastIndexOf("-")>0&&(i=i[0]+i.substring(1).replace(/-/g,"")),i==="-"||i==="-0"))return;let n=Number(i);Number.isNaN(n)||(n=this.min!==void 0?Math.max(n,this.min):n,n=this.max!==void 0?Math.min(n,this.max):n,this.value!==n&&(this._value=n,e&&(e.value=this.value.toString()),this.requestUpdate(),this.dispatchEvent(this.onValueChange)))}onBlur(){const{value:t}=this._input;t&&Number.isNaN(Number(t.value))&&(t.value=this.value.toString())}onSliderMouseDown(t){document.body.style.cursor="w-resize";const{clientX:e}=t,i=this.value;let n=!1;const o=a=>{var l;n=!0;const{clientX:c}=a,d=this.step??1,u=((l=d.toString().split(".")[1])==null?void 0:l.length)||0,h=1/(this.sensitivity??1),p=(c-e)/h;if(Math.floor(Math.abs(p))!==Math.abs(p))return;const m=i+p*d;this.setValue(m.toFixed(u))},r=()=>{this.slider=!0,this.removeEventListener("blur",r)},s=()=>{document.removeEventListener("mousemove",o),document.body.style.cursor="default",n?n=!1:(this.addEventListener("blur",r),this.slider=!1,requestAnimationFrame(()=>this.focus())),document.removeEventListener("mouseup",s)};document.addEventListener("mousemove",o),document.addEventListener("mouseup",s)}onFocus(t){t.stopPropagation();const e=i=>{i.key==="Escape"&&(this.blur(),window.removeEventListener("keydown",e))};window.addEventListener("keydown",e)}connectedCallback(){super.connectedCallback(),this.min&&this.min>this.value&&(this._value=this.min),this.max&&this.max<this.value&&(this._value=this.max)}focus(){const{value:t}=this._input;t&&t.focus()}render(){const t=w`
      ${this.pref||this.icon?w`<bim-label
            style="pointer-events: auto"
            @mousedown=${this.onSliderMouseDown}
            .icon=${this.icon}
            >${this.pref}</bim-label
          >`:null}
      <input
        ${me(this._input)}
        type="text"
        aria-label=${this.label||this.name||"Number Input"}
        size="1"
        @input=${s=>s.stopPropagation()}
        @change=${this.onChange}
        @blur=${this.onBlur}
        @focus=${this.onFocus}
        .value=${this.value.toString()}
      />
      ${this.suffix?w`<bim-label
            style="pointer-events: auto"
            @mousedown=${this.onSliderMouseDown}
            >${this.suffix}</bim-label
          >`:null}
    `,e=this.min??-1/0,i=this.max??1/0,n=100*(this.value-e)/(i-e),o=w`
      <style>
        .slider-indicator {
          width: ${`${n}%`};
        }
      </style>
      <div class="slider" @mousedown=${this.onSliderMouseDown}>
        <div class="slider-indicator"></div>
        ${this.pref||this.icon?w`<bim-label
              style="z-index: 1; margin-right: 0.125rem"
              .icon=${this.icon}
              >${`${this.pref}: `}</bim-label
            >`:null}
        <bim-label style="z-index: 1;">${this.value}</bim-label>
        ${this.suffix?w`<bim-label style="z-index: 1;">${this.suffix}</bim-label>`:null}
      </div>
    `,r=`${this.label||this.name||this.pref?`${this.label||this.name||this.pref}: `:""}${this.value}${this.suffix??""}`;return w`
      <bim-input
        title=${r}
        .label=${this.label}
        .icon=${this.icon}
        .vertical=${this.vertical}
      >
        ${this.slider?o:t}
      </bim-input>
    `}};tp.styles=ee`
    :host {
      --bim-input--bgc: var(
        --bim-number-input--bgc,
        var(--bim-ui_bg-contrast-20)
      );
      --bim-input--olw: var(--bim-number-input--olw, 2px);
      --bim-input--olc: var(--bim-number-input--olc, transparent);
      --bim-input--bdrs: var(--bim-number-input--bdrs, var(--bim-ui_size-4xs));
      --bim-input--p: 0 0.375rem;
      flex: 1;
      display: block;
    }

    :host(:focus) {
      --bim-input--olw: var(--bim-number-input--olw, 2px);
      --bim-input--olc: var(
        --bim-number-input¡focus--c,
        var(--bim-ui_accent-base)
      );
    }

    :host(:not([slider])) bim-label {
      --bim-label--c: var(
        --bim-number-input_affixes--c,
        var(--bim-ui_bg-contrast-60)
      );
      --bim-label--fz: var(
        --bim-number-input_affixes--fz,
        var(--bim-ui_size-xs)
      );
    }

    p {
      margin: 0;
      padding: 0;
    }

    input {
      background-color: transparent;
      outline: none;
      border: none;
      padding: 0;
      flex-grow: 1;
      text-align: right;
      font-family: inherit;
      font-feature-settings: inherit;
      font-variation-settings: inherit;
      font-size: var(--bim-number-input--fz, var(--bim-ui_size-xs));
      color: var(--bim-number-input--c, var(--bim-ui_bg-contrast-100));
    }

    :host([suffix]:not([pref])) input {
      text-align: left;
    }

    :host([slider]) {
      --bim-input--p: 0;
    }

    :host([slider]) .slider {
      --bim-label--c: var(--bim-ui_bg-contrast-100);
    }

    .slider {
      position: relative;
      display: flex;
      justify-content: center;
      width: 100%;
      height: 100%;
      padding: 0 0.5rem;
    }

    .slider-indicator {
      height: 100%;
      background-color: var(--bim-ui_main-base);
      position: absolute;
      top: 0;
      left: 0;
      border-radius: var(--bim-input--bdrs, var(--bim-ui_size-4xs));
    }

    bim-input {
      display: flex;
    }

    bim-label {
      pointer-events: none;
    }
  `;let Ue=tp;Ke([x({type:String,reflect:!0})],Ue.prototype,"name",2);Ke([x({type:String,reflect:!0})],Ue.prototype,"icon",2);Ke([x({type:String,reflect:!0})],Ue.prototype,"label",2);Ke([x({type:String,reflect:!0})],Ue.prototype,"pref",2);Ke([x({type:Number,reflect:!0})],Ue.prototype,"min",2);Ke([x({type:Number,reflect:!0})],Ue.prototype,"value",1);Ke([x({type:Number,reflect:!0})],Ue.prototype,"step",2);Ke([x({type:Number,reflect:!0})],Ue.prototype,"sensitivity",2);Ke([x({type:Number,reflect:!0})],Ue.prototype,"max",2);Ke([x({type:String,reflect:!0})],Ue.prototype,"suffix",2);Ke([x({type:Boolean,reflect:!0})],Ue.prototype,"vertical",2);Ke([x({type:Boolean,reflect:!0})],Ue.prototype,"slider",2);var cw=Object.defineProperty,dw=Object.getOwnPropertyDescriptor,Po=(t,e,i,n)=>{for(var o=n>1?void 0:n?dw(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&cw(e,i,o),o};const ip=class extends J{constructor(){super(...arguments),this.onValueChange=new Event("change"),this._hidden=!1,this.headerHidden=!1,this.valueTransform={},this.activationButton=document.createElement("bim-button")}set hidden(t){this._hidden=t,this.activationButton.active=!t,this.dispatchEvent(new Event("hiddenchange"))}get hidden(){return this._hidden}get value(){return ao(this,this.valueTransform)}set value(t){const e=[...this.children];for(const i in t){const n=e.find(r=>{const s=r;return s.name===i||s.label===i});if(!n)continue;const o=n;o.value=t[i]}}animatePanles(){const t=[{maxHeight:"100vh",maxWidth:"100vw",opacity:1},{maxHeight:"100vh",maxWidth:"100vw",opacity:0},{maxHeight:0,maxWidth:0,opacity:0}];this.animate(t,{duration:300,easing:"cubic-bezier(0.65, 0.05, 0.36, 1)",direction:this.hidden?"normal":"reverse",fill:"forwards"})}connectedCallback(){super.connectedCallback(),this.activationButton.active=!this.hidden,this.activationButton.onclick=()=>{this.hidden=!this.hidden,this.animatePanles()}}disconnectedCallback(){super.disconnectedCallback(),this.activationButton.remove()}collapseSections(){const t=this.querySelectorAll("bim-panel-section");for(const e of t)e.collapsed=!0}expandSections(){const t=this.querySelectorAll("bim-panel-section");for(const e of t)e.collapsed=!1}render(){return this.activationButton.icon=this.icon,this.activationButton.label=this.label||this.name,this.activationButton.tooltipTitle=this.label||this.name,w`
      <div class="parent">
        ${this.label||this.name||this.icon?w`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
        <div class="sections">
          <slot></slot>
        </div>
      </div>
    `}};ip.styles=[Qt.scrollbar,ee`
      :host {
        display: flex;
        border-radius: var(--bim-ui_size-base);
        background-color: var(--bim-ui_bg-base);
        overflow: auto;
      }

      :host([hidden]) {
        max-height: 0;
        max-width: 0;
        opacity: 0;
      }

      .parent {
        display: flex;
        flex: 1;
        flex-direction: column;
        pointer-events: auto;
        overflow: auto;
      }

      .parent bim-label {
        --bim-label--c: var(--bim-panel--c, var(--bim-ui_bg-contrast-80));
        --bim-label--fz: var(--bim-panel--fz, var(--bim-ui_size-sm));
        font-weight: 600;
        padding: 1rem;
        flex-shrink: 0;
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([header-hidden]) .parent bim-label {
        display: none;
      }

      .sections {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: auto;
        flex: 1;
      }

      ::slotted(bim-panel-section:not(:last-child)) {
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }
    `];let Oi=ip;Po([x({type:String,reflect:!0})],Oi.prototype,"icon",2);Po([x({type:String,reflect:!0})],Oi.prototype,"name",2);Po([x({type:String,reflect:!0})],Oi.prototype,"label",2);Po([x({type:Boolean,reflect:!0})],Oi.prototype,"hidden",1);Po([x({type:Boolean,attribute:"header-hidden",reflect:!0})],Oi.prototype,"headerHidden",2);var uw=Object.defineProperty,zo=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&uw(e,i,o),o};const np=class extends J{constructor(){super(...arguments),this.onValueChange=new Event("change"),this.valueTransform={},this.componentHeight=-1}get value(){const t=this.parentElement;let e;return t instanceof Oi&&(e=t.valueTransform),Object.values(this.valueTransform).length!==0&&(e=this.valueTransform),ao(this,e)}set value(t){const e=[...this.children];for(const i in t){const n=e.find(r=>{const s=r;return s.name===i||s.label===i});if(!n)continue;const o=n;o.value=t[i]}}setFlexAfterTransition(){var t;const e=(t=this.shadowRoot)==null?void 0:t.querySelector(".components");e&&setTimeout(()=>{this.collapsed?e.style.removeProperty("flex"):e.style.setProperty("flex","1")},150)}animateHeader(){var t;const e=(t=this.shadowRoot)==null?void 0:t.querySelector(".components");this.componentHeight<0&&(this.collapsed?this.componentHeight=e.clientHeight:(e.style.setProperty("transition","none"),e.style.setProperty("height","auto"),e.style.setProperty("padding","0.125rem 1rem 1rem"),this.componentHeight=e.clientHeight,requestAnimationFrame(()=>{e.style.setProperty("height","0px"),e.style.setProperty("padding","0 1rem 0"),e.style.setProperty("transition","height 0.25s cubic-bezier(0.65, 0.05, 0.36, 1), padding 0.25s cubic-bezier(0.65, 0.05, 0.36, 1)")}))),this.collapsed?(e.style.setProperty("height",`${this.componentHeight}px`),requestAnimationFrame(()=>{e.style.setProperty("height","0px"),e.style.setProperty("padding","0 1rem 0")})):(e.style.setProperty("height","0px"),e.style.setProperty("padding","0 1rem 0"),requestAnimationFrame(()=>{e.style.setProperty("height",`${this.componentHeight}px`),e.style.setProperty("padding","0.125rem 1rem 1rem")})),this.setFlexAfterTransition()}onHeaderClick(){this.fixed||(this.collapsed=!this.collapsed,this.animateHeader())}handelSlotChange(t){t.target.assignedElements({flatten:!0}).forEach((e,i)=>{const n=i*.05;e.style.setProperty("transition-delay",`${n}s`)})}handlePointerEnter(){const t=this.renderRoot.querySelector(".expand-icon");this.collapsed?t?.style.setProperty("animation","collapseAnim 0.5s"):t?.style.setProperty("animation","expandAnim 0.5s")}handlePointerLeave(){const t=this.renderRoot.querySelector(".expand-icon");t?.style.setProperty("animation","none")}render(){const t=this.label||this.icon||this.name||this.fixed,e=w`<svg
      xmlns="http://www.w3.org/2000/svg"
      height="1.125rem"
      viewBox="0 0 24 24"
      width="1.125rem"
      class="expand-icon"
    >
      <path d="M0 0h24v24H0z" fill="none" />
      <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
    </svg>`,i=w`
      <div
        class="header"
        title=${this.label??""}
        @pointerenter=${this.handlePointerEnter}
        @pointerleave=${this.handlePointerLeave}
        @click=${this.onHeaderClick}
      >
        ${this.label||this.icon||this.name?w`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
        ${this.fixed?null:e}
      </div>
    `;return w`
      <div class="parent">
        ${t?i:null}
        <div class="components" style="flex: 1;">
          <div>
            <slot @slotchange=${this.handelSlotChange}></slot>
          </div>
        </div>
      </div>
    `}};np.styles=[Qt.scrollbar,ee`
      :host {
        display: block;
        pointer-events: auto;
      }

      :host .parent {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      :host(:not([fixed])) .header:hover {
        --bim-label--c: var(--bim-ui_accent-base);
        color: var(--bim-ui_accent-base);
        cursor: pointer;
      }

      :host(:not([fixed])) .header:hover .expand-icon {
        fill: var(--bim-ui_accent-base);
      }

      .header {
        --bim-label--fz: var(--bim-ui_size-sm);
        --bim-label--c: var(
          --bim-panel-section_hc,
          var(--bim-ui_bg-contrast-80)
        );
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        height: 1.5rem;
        padding: 0.75rem 1rem;
      }

      .expand-icon {
        fill: var(--bim-ui_bg-contrast-80);
        transition: transform 0.2s;
      }

      :host([collapsed]) .expand-icon {
        transform: rotateZ(-180deg);
      }

      .title {
        display: flex;
        align-items: center;
        column-gap: 0.5rem;
      }

      .title p {
        font-size: var(--bim-ui_size-sm);
      }

      .components {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        row-gap: 0.75rem;
        padding: 0 1rem 1rem;
        box-sizing: border-box;
        transition:
          height 0.25s cubic-bezier(0.65, 0.05, 0.36, 1),
          padding 0.25s cubic-bezier(0.65, 0.05, 0.36, 1);
      }

      .components > div {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        flex: 1;
        overflow: auto;
      }

      :host(:not([icon]):not([label])) .components {
        padding: 1rem;
      }

      :host(:not([fixed])[collapsed]) .components {
        padding: 0 1rem 0;
        height: 0px;
      }

      bim-label {
        pointer-events: none;
      }

      ::slotted(*) {
        transition:
          transform 0.25s cubic-bezier(0.65, 0.05, 0.36, 1),
          opacity 0.25s cubic-bezier(0.65, 0.05, 0.36, 1);
      }

      :host(:not([fixed])[collapsed]) ::slotted(*) {
        transform: translateX(-20%);
        opacity: 0;
      }

      @keyframes expandAnim {
        0%,
        100% {
          transform: translateY(0%);
        }
        25% {
          transform: translateY(-30%);
        }
        50% {
          transform: translateY(10%);
        }
        75% {
          transform: translateY(-30%);
        }
      }

      @keyframes collapseAnim {
        0%,
        100% {
          transform: translateY(0%) rotateZ(-180deg);
        }
        25% {
          transform: translateY(30%) rotateZ(-180deg);
        }
        50% {
          transform: translateY(-10%) rotateZ(-180deg);
        }
        75% {
          transform: translateY(30%) rotateZ(-180deg);
        }
      }
    `];let _n=np;zo([x({type:String,reflect:!0})],_n.prototype,"icon");zo([x({type:String,reflect:!0})],_n.prototype,"label");zo([x({type:String,reflect:!0})],_n.prototype,"name");zo([x({type:Boolean,reflect:!0})],_n.prototype,"fixed");zo([x({type:Boolean,reflect:!0})],_n.prototype,"collapsed");var hw=Object.defineProperty,Lo=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&hw(e,i,o),o};const op=class extends J{constructor(){super(...arguments),this.vertical=!1,this.onValueChange=new Event("change"),this._canEmitEvents=!1,this._value=document.createElement("bim-option"),this.onOptionClick=t=>{this._value=t.target,this.setAnimatedBackgound(),this.dispatchEvent(this.onValueChange);for(const e of this.children)e instanceof he&&(e.checked=e===t.target)}}get _options(){return[...this.querySelectorAll("bim-option")]}set value(t){const e=this.findOption(t);if(e){for(const i of this._options)i.checked=i===e;this._value=e,this.setAnimatedBackgound(),this._canEmitEvents&&this.dispatchEvent(this.onValueChange)}}get value(){return this._value.value}onSlotChange(t){const e=t.target.assignedElements();for(const i of e)i instanceof he&&(i.noMark=!0,i.removeEventListener("click",this.onOptionClick),i.addEventListener("click",this.onOptionClick))}findOption(t){return this._options.find(e=>e instanceof he?e.label===t||e.value===t:!1)}doubleRequestAnimationFrames(t){requestAnimationFrame(()=>requestAnimationFrame(t))}setAnimatedBackgound(t=!1){const e=this.renderRoot.querySelector(".animated-background"),i=this._value;requestAnimationFrame(()=>{var n,o,r,s;const a=(s=(r=(o=(n=i?.parentElement)==null?void 0:n.shadowRoot)==null?void 0:o.querySelector("bim-input"))==null?void 0:r.shadowRoot)==null?void 0:s.querySelector(".input"),l={width:i?.clientWidth,height:i?.clientHeight,top:(i?.offsetTop??0)-(a?.offsetTop??0),left:(i?.offsetLeft??0)-(a?.offsetLeft??0)};e?.style.setProperty("width",`${l.width}px`),e?.style.setProperty("height",`${l.height}px`),e?.style.setProperty("top",`${l.top}px`),e?.style.setProperty("left",`${l.left}px`)}),t&&this.doubleRequestAnimationFrames(()=>{const n="ease";e?.style.setProperty("transition",`width ${.3}s ${n}, height ${.3}s ${n}, top ${.3}s ${n}, left ${.3}s ${n}`)})}firstUpdated(){const t=[...this.children].find(e=>e instanceof he&&e.checked);t&&(this._value=t),window.addEventListener("load",()=>{this.setAnimatedBackgound(!0)}),new ResizeObserver(()=>{this.setAnimatedBackgound()}).observe(this)}render(){return w`
      <bim-input
        .vertical=${this.vertical}
        .label=${this.label}
        .icon=${this.icon}
      >
        <div class="animated-background"></div>
        <slot @slotchange=${this.onSlotChange}></slot>
      </bim-input>
    `}};op.styles=ee`
    :host {
      --bim-input--bgc: var(--bim-ui_bg-contrast-20);
      --bim-input--g: 0;
      --bim-option--jc: center;
      flex: 1;
      display: block;
    }

    ::slotted(bim-option) {
      position: relative;
      border-radius: 0;
      overflow: hidden;
      min-width: min-content;
      min-height: min-content;
      transition: background-color 0.2s;
    }

    .animated-background {
      position: absolute;
      background: var(--bim-ui_main-base);
      width: 0;
      height: 0;
      top: 0;
      left: 0;
    }

    ::slotted(bim-option[checked]) {
      --bim-label--c: var(--bim-ui_main-contrast);
    }

    ::slotted(bim-option:not([checked]):hover) {
      background-color: #0003;
    }
  `;let xn=op;Lo([x({type:String,reflect:!0})],xn.prototype,"name");Lo([x({type:String,reflect:!0})],xn.prototype,"icon");Lo([x({type:String,reflect:!0})],xn.prototype,"label");Lo([x({type:Boolean,reflect:!0})],xn.prototype,"vertical");Lo([ki()],xn.prototype,"_value");const pw=()=>w`
    <style>
      div {
        display: flex;
        gap: 0.375rem;
        border-radius: 0.25rem;
        min-height: 1.25rem;
      }

      [data-type="row"] {
        background-color: var(--bim-ui_bg-contrast-10);
        animation: row-loading 1s linear infinite alternate;
        padding: 0.5rem;
      }

      [data-type="cell"] {
        background-color: var(--bim-ui_bg-contrast-20);
        flex: 0.25;
      }

      @keyframes row-loading {
        0% {
          background-color: var(--bim-ui_bg-contrast-10);
        }
        100% {
          background-color: var(--bim-ui_bg-contrast-20);
        }
      }
    </style>
    <div style="display: flex; flex-direction: column;">
      <div data-type="row" style="gap: 2rem">
        <div data-type="cell" style="flex: 1"></div>
        <div data-type="cell" style="flex: 2"></div>
        <div data-type="cell" style="flex: 1"></div>
        <div data-type="cell" style="flex: 0.5"></div>
      </div>
      <div style="display: flex;">
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
        <div data-type="row" style="flex: 2">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
        <div data-type="row" style="flex: 1">
          <div data-type="cell"></div>
        </div>
        <div data-type="row" style="flex: 0.5">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
      </div>
      <div style="display: flex;">
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
        <div data-type="row" style="flex: 2">
          <div data-type="cell"></div>
        </div>
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
        <div data-type="row" style="flex: 0.5">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
      </div>
      <div style="display: flex;">
        <div data-type="row" style="flex: 1">
          <div data-type="cell"></div>
        </div>
        <div data-type="row" style="flex: 2">
          <div data-type="cell" style="flex: 0.5"></div>
        </div>
        <div data-type="row" style="flex: 1">
          <div data-type="cell" style="flex: 0.75"></div>
        </div>
        <div data-type="row" style="flex: 0.5">
          <div data-type="cell" style="flex: 0.7s5"></div>
        </div>
      </div>
    </div>
  `,fw=()=>w`
    <style>
      .loader {
        grid-area: Processing;
        position: relative;
        padding: 0.125rem;
      }
      .loader:before {
        content: "";
        position: absolute;
      }
      .loader .loaderBar {
        position: absolute;
        top: 0;
        right: 100%;
        bottom: 0;
        left: 0;
        background: var(--bim-ui_main-base);
        /* width: 25%; */
        width: 0;
        animation: borealisBar 2s linear infinite;
      }

      @keyframes borealisBar {
        0% {
          left: 0%;
          right: 100%;
          width: 0%;
        }
        10% {
          left: 0%;
          right: 75%;
          width: 25%;
        }
        90% {
          right: 0%;
          left: 75%;
          width: 25%;
        }
        100% {
          left: 100%;
          right: 0%;
          width: 0%;
        }
      }
    </style>
    <div class="loader">
      <div class="loaderBar"></div>
    </div>
  `;var mw=Object.defineProperty,bw=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&mw(e,i,o),o};const rp=class extends J{constructor(){super(...arguments),this.column="",this.columnIndex=0,this.table=null,this.group=null,this.row=null,this.rowData={}}get data(){return this.column?this.rowData[this.column]:null}get dataTransform(){var t,e,i,n;const o=(e=(t=this.row)==null?void 0:t.dataTransform)==null?void 0:e[this.column],r=(i=this.table)==null?void 0:i.dataTransform[this.column],s=(n=this.table)==null?void 0:n.defaultContentTemplate;return o||r||s}get templateValue(){const{data:t,rowData:e,group:i}=this,n=this.dataTransform;if(n&&t!=null&&i){const o=n(t,e,i);return typeof o=="string"||typeof o=="boolean"||typeof o=="number"?w`<bim-label>${o}</bim-label>`:o}return t!=null?w`<bim-label>${t}</bim-label>`:ne}connectedCallback(){super.connectedCallback(),this.style.gridArea=this.column.toString()}render(){return w`${this.templateValue}`}};rp.styles=ee`
    :host {
      padding: 0.375rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    :host([data-column-index="0"]) {
      justify-content: normal;
    }

    :host([data-column-index="0"]:not([data-cell-header]))
      ::slotted(bim-label) {
      text-align: left;
    }

    ::slotted(*) {
      --bim-input--bgc: transparent;
      --bim-input--olc: var(--bim-ui_bg-contrast-20);
      --bim-input--olw: 1px;
    }

    ::slotted(bim-input) {
      --bim-input--olw: 0;
    }
  `;let sp=rp;bw([x({type:String,reflect:!0})],sp.prototype,"column");const ap=class extends J{constructor(){super(...arguments),this._groups=[],this.group=this.closest("bim-table-group"),this._data=[],this.table=this.closest("bim-table")}get data(){var t;return((t=this.group)==null?void 0:t.data.children)??this._data}set data(t){this._data=t}clean(){for(const t of this._groups)t.remove();this._groups=[]}render(){return this.clean(),w`
      <slot></slot>
      ${this.data.map(t=>{const e=document.createElement("bim-table-group");return this._groups.push(e),e.table=this.table,e.data=t,e})}
    `}};ap.styles=ee`
    :host {
      --bim-button--bgc: transparent;
      position: relative;
      display: block;
      overflow: hidden;
      grid-area: Children;
    }

    :host([hidden]) {
      height: 0;
      opacity: 0;
    }

    ::slotted(.branch.branch-vertical) {
      top: 0;
      bottom: 1.125rem;
    }
  `;let gw=ap;/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const lp="important",yw=" !"+lp,Ct=wh(class extends $h{constructor(t){var e;if(super(t),t.type!==vh.ATTRIBUTE||t.name!=="style"||((e=t.strings)==null?void 0:e.length)>2)throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.")}render(t){return Object.keys(t).reduce((e,i)=>{const n=t[i];return n==null?e:e+`${i=i.includes("-")?i:i.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g,"-$&").toLowerCase()}:${n};`},"")}update(t,[e]){const{style:i}=t.element;if(this.ft===void 0)return this.ft=new Set(Object.keys(e)),this.render(e);for(const n of this.ft)e[n]==null&&(this.ft.delete(n),n.includes("-")?i.removeProperty(n):i[n]=null);for(const n in e){const o=e[n];if(o!=null){this.ft.add(n);const r=typeof o=="string"&&o.endsWith(yw);n.includes("-")||r?i.setProperty(n,r?o.slice(0,-11):o,r?lp:""):i[n]=o}}return xi}});var vw=Object.defineProperty,ww=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&vw(e,i,o),o};const cp=class extends J{constructor(){super(...arguments),this.childrenHidden=!0,this.table=null,this.data={data:{}}}get rowElement(){const t=this.shadowRoot;return t?t.querySelector("bim-table-row"):null}get childrenElement(){const t=this.shadowRoot;return t?t.querySelector("bim-table-children"):null}get _isChildrenEmpty(){return!(this.data.children&&this.data.children.length!==0)}connectedCallback(){super.connectedCallback(),this.table&&this.table.expanded?this.childrenHidden=!1:this.childrenHidden=!0}disconnectedCallback(){super.disconnectedCallback(),this.data={data:{}}}toggleChildren(t){this.childrenHidden=typeof t>"u"?!this.childrenHidden:!t,this.animateTableChildren(!0)}animateTableChildren(t=!0){if(!t){requestAnimationFrame(()=>{var r;const s=this.renderRoot.querySelector(".caret"),a=this.renderRoot.querySelector(".branch-vertical"),l=(r=this.renderRoot.querySelector("bim-table-children"))==null?void 0:r.querySelector(".branch-vertical");s.style.setProperty("transform",`translateY(-50%) rotate(${this.childrenHidden?"0":"90"}deg)`),a.style.setProperty("transform",`scaleY(${this.childrenHidden?"0":"1"})`),l?.style.setProperty("transform",`scaleY(${this.childrenHidden?"0":"1"})`)});return}const e=500,i=0,n=200,o=350;requestAnimationFrame(()=>{var r;const s=this.renderRoot.querySelector("bim-table-children"),a=this.renderRoot.querySelector(".caret"),l=this.renderRoot.querySelector(".branch-vertical"),c=(r=this.renderRoot.querySelector("bim-table-children"))==null?void 0:r.querySelector(".branch-vertical"),d=()=>{var g;const f=(g=s?.renderRoot)==null?void 0:g.querySelectorAll("bim-table-group");f?.forEach((v,b)=>{v.style.setProperty("opacity","0"),v.style.setProperty("left","-30px");const y=[{opacity:"0",left:"-30px"},{opacity:"1",left:"0"}];v.animate(y,{duration:e/2,delay:50+b*i,easing:"cubic-bezier(0.65, 0.05, 0.36, 1)",fill:"forwards"})})},u=()=>{const g=[{transform:"translateY(-50%) rotate(90deg)"},{transform:"translateY(-50%) rotate(0deg)"}];a?.animate(g,{duration:o,easing:"cubic-bezier(0.68, -0.55, 0.27, 1.55)",fill:"forwards",direction:this.childrenHidden?"normal":"reverse"})},h=()=>{const g=[{transform:"scaleY(1)"},{transform:"scaleY(0)"}];l?.animate(g,{duration:n,easing:"cubic-bezier(0.4, 0, 0.2, 1)",delay:i,fill:"forwards",direction:this.childrenHidden?"normal":"reverse"})},p=()=>{var g;const f=(g=this.renderRoot.querySelector("bim-table-row"))==null?void 0:g.querySelector(".branch-horizontal");if(f){f.style.setProperty("transform-origin","center right");const v=[{transform:"scaleX(0)"},{transform:"scaleX(1)"}];f.animate(v,{duration:n,easing:"cubic-bezier(0.4, 0, 0.2, 1)",fill:"forwards",direction:this.childrenHidden?"normal":"reverse"})}},m=()=>{const g=[{transform:"scaleY(0)"},{transform:"scaleY(1)"}];c?.animate(g,{duration:n*1.2,easing:"cubic-bezier(0.4, 0, 0.2, 1)",fill:"forwards",delay:(i+n)*.7})};d(),u(),h(),p(),m()})}firstUpdated(){this.renderRoot.querySelectorAll(".caret").forEach(t=>{var e,i,n;if(!this.childrenHidden){t.style.setProperty("transform","translateY(-50%) rotate(90deg)");const o=(e=t.parentElement)==null?void 0:e.querySelector(".branch-horizontal");o&&o.style.setProperty("transform","scaleX(0)");const r=(n=(i=t.parentElement)==null?void 0:i.parentElement)==null?void 0:n.querySelectorAll(".branch-vertical");r?.forEach(s=>{s.style.setProperty("transform","scaleY(1)")})}})}render(){if(!this.table)return w`${ne}`;const t=this.table.getGroupIndentation(this.data)??0;let e;if(!this.table.noIndentation){const r={left:`${t-1+(this.table.selectableRows?2.05:.5625)}rem`};e=w`<div style=${Ct(r)} class="branch branch-horizontal"></div>`}const i=w`
      ${this.table.noIndentation?null:w`
            <style>
              .branch-vertical {
                left: ${t+(this.table.selectableRows?1.9375:.5625)}rem;
              }
            </style>
            <div class="branch branch-vertical"></div>
          `}
    `;let n;if(!this.table.noIndentation){const r=document.createElementNS("http://www.w3.org/2000/svg","svg");if(r.setAttribute("height","9.9"),r.setAttribute("width","7.5"),r.setAttribute("viewBox","0 0 4.6666672 7.7"),this.table.noCarets){const a=document.createElementNS("http://www.w3.org/2000/svg","circle");a.setAttribute("cx","2.3333336"),a.setAttribute("cy","3.85"),a.setAttribute("r","2.5"),r.append(a)}else{const a=document.createElementNS("http://www.w3.org/2000/svg","path");a.setAttribute("d","m 1.7470835,6.9583848 2.5899999,-2.59 c 0.39,-0.39 0.39,-1.02 0,-1.41 L 1.7470835,0.36838483 c -0.63,-0.62000003 -1.71000005,-0.18 -1.71000005,0.70999997 v 5.17 c 0,0.9 1.08000005,1.34 1.71000005,0.71 z"),r.append(a)}const s={left:`${(this.table.selectableRows?1.5:.125)+t}rem`,cursor:`${this.table.noCarets?"unset":"pointer"}`};n=w`<div @click=${a=>{var l;(l=this.table)!=null&&l.noCarets||(a.stopPropagation(),this.toggleChildren())}} style=${Ct(s)} class="caret">${r}</div>`}let o;return!this._isChildrenEmpty&&!this.childrenHidden&&(o=w`
        <bim-table-children ${me(r=>{if(!r)return;const s=r;s.table=this.table,s.group=this})}>${i}</bim-table-children>
      `),w`
      <div class="parent">
        <bim-table-row ${me(r=>{var s;if(!r)return;const a=r;a.table=this.table,a.group=this,(s=this.table)==null||s.dispatchEvent(new CustomEvent("rowcreated",{detail:{row:a}}))})}>
          ${Hi(!this._isChildrenEmpty,()=>i)}
          ${Hi(t!==0,()=>e)}
          ${Hi(!this.table.noIndentation&&!this._isChildrenEmpty,()=>n)}
        </bim-table-row>
        ${o}
      </div>
    `}};cp.styles=ee`
    :host {
      position: relative;
    }

    .parent {
      display: grid;
      grid-template-areas: "Data" "Children";
    }

    .branch {
      position: absolute;
      z-index: 1;
    }

    .branch-vertical {
      border-left: 1px dotted var(--bim-ui_bg-contrast-40);
      transform-origin: top center;
      transform: scaleY(0);
    }

    .branch-horizontal {
      top: 50%;
      width: 1rem;
      border-bottom: 1px dotted var(--bim-ui_bg-contrast-40);
    }

    .branch-horizontal {
      transform-origin: center left;
    }

    .caret {
      position: absolute;
      z-index: 2;
      transform: translateY(-50%) rotate(0deg);
      top: 50%;
      display: flex;
      width: 0.95rem;
      height: 0.95rem;
      justify-content: center;
      align-items: center;
    }

    .caret svg {
      fill: var(--bim-ui_bg-contrast-60);
    }
  `;let dp=cp;ww([x({type:Boolean,attribute:"children-hidden",reflect:!0})],dp.prototype,"childrenHidden");var $w=Object.defineProperty,En=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&$w(e,i,o),o};const up=class extends J{constructor(){super(...arguments),this.selected=!1,this.columns=[],this.hiddenColumns=[],this.group=null,this._data={},this.isHeader=!1,this.table=null,this.onTableColumnsChange=()=>{this.table&&(this.columns=this.table.columns)},this.onTableColumnsHidden=()=>{this.table&&(this.hiddenColumns=this.table.hiddenColumns)},this._intersecting=!1,this._timeOutDelay=250,this._observer=new IntersectionObserver(t=>{window.clearTimeout(this._intersectTimeout),this._intersectTimeout=void 0,t[0].isIntersecting?this._intersectTimeout=window.setTimeout(()=>{this._intersecting=!0},this._timeOutDelay):this._intersecting=!1},{rootMargin:"36px"}),this.dataTransform=null,this._interval=null,this.clearDataTransform=()=>{this.dataTransform=null,this._interval!==null&&(clearInterval(this._interval),this._interval=null)},this._cache={}}get groupData(){var t;return(t=this.group)==null?void 0:t.data}get data(){var t;return((t=this.group)==null?void 0:t.data.data)??this._data}set data(t){this._data=t}get _columnNames(){return this.columns.filter(t=>!this.hiddenColumns.includes(t.name)).map(t=>t.name)}get _columnWidths(){return this.columns.filter(t=>!this.hiddenColumns.includes(t.name)).map(t=>t.width)}get _isSelected(){var t;return(t=this.table)==null?void 0:t.selection.has(this.data)}onSelectionChange(t){if(!this.table)return;const e=t.target;this.selected=e.value,e.value?(this.table.selection.add(this.data),this.table.dispatchEvent(new CustomEvent("rowselected",{detail:{data:this.data}}))):(this.table.selection.delete(this.data),this.table.dispatchEvent(new CustomEvent("rowdeselected",{detail:{data:this.data}})))}firstUpdated(t){super.firstUpdated(t),this._observer.observe(this)}connectedCallback(){super.connectedCallback(),this.toggleAttribute("selected",this._isSelected),this.table&&(this.columns=this.table.columns,this.hiddenColumns=this.table.hiddenColumns,this.table.addEventListener("columnschange",this.onTableColumnsChange),this.table.addEventListener("columnshidden",this.onTableColumnsHidden),this.style.gridTemplateAreas=`"${this.table.selectableRows?"Selection":""} ${this._columnNames.join(" ")}"`,this.style.gridTemplateColumns=`${this.table.selectableRows?"1.6rem":""} ${this._columnWidths.join(" ")}`)}disconnectedCallback(){super.disconnectedCallback(),this._observer.unobserve(this),this.columns=[],this.hiddenColumns=[],this.toggleAttribute("selected",!1),this.data={},this.table&&(this.table.removeEventListener("columnschange",this.onTableColumnsChange),this.table.removeEventListener("columnshidden",this.onTableColumnsHidden),this.table=null),this.clean()}applyAdaptativeDataTransform(t){this.addEventListener("pointerenter",()=>{this.dataTransform=t,this._interval=window.setInterval(()=>{this.matches(":hover")||this.clearDataTransform()},50)})}clean(){clearTimeout(this._intersectTimeout),this._intersectTimeout=void 0,this._timeOutDelay=250;for(const[,t]of Object.entries(this._cache))t.remove();this._cache={}}render(){if(!(this.table&&this._intersecting))return w`${ne}`;const t=this.table.getRowIndentation(this.data)??0,e=[];for(const i in this.data){if(this.hiddenColumns.includes(i))continue;const n=document.createElement("bim-table-cell");n.group=this.group,n.table=this.table,n.row=this,n.column=i,this._columnNames.indexOf(i)===0&&(n.style.marginLeft=`${this.table.noIndentation?0:t+.75}rem`);const o=this._columnNames.indexOf(i);n.setAttribute("data-column-index",String(o)),n.toggleAttribute("data-no-indentation",o===0&&this.table.noIndentation),n.toggleAttribute("data-cell-header",this.isHeader),n.rowData=this.data,this.table.dispatchEvent(new CustomEvent("cellcreated",{detail:{cell:n}})),e.push(n)}return this._timeOutDelay=0,w`
      ${!this.isHeader&&this.table.selectableRows?w`<bim-checkbox
            @change=${this.onSelectionChange}
            .checked=${this._isSelected??!1}
            style="align-self: center; justify-self: center"
          ></bim-checkbox>`:null}
      ${e}
      <slot></slot>
    `}};up.styles=ee`
    :host {
      position: relative;
      grid-area: Data;
      display: grid;
      min-height: 2.25rem;
      transition: all 0.15s;
    }

    ::slotted(.branch.branch-vertical) {
      top: 50%;
      bottom: 0;
    }

    :host([selected]) {
      background-color: color-mix(
        in lab,
        var(--bim-ui_bg-contrast-20) 30%,
        var(--bim-ui_accent-base) 10%
      );
    }
  `;let Ii=up;En([x({type:Boolean,reflect:!0})],Ii.prototype,"selected");En([x({attribute:!1})],Ii.prototype,"columns");En([x({attribute:!1})],Ii.prototype,"hiddenColumns");En([x({type:Boolean,attribute:"is-header",reflect:!0})],Ii.prototype,"isHeader");En([ki()],Ii.prototype,"_intersecting");En([ki()],Ii.prototype,"dataTransform");var _w=Object.defineProperty,xw=Object.getOwnPropertyDescriptor,Qe=(t,e,i,n)=>{for(var o=n>1?void 0:n?xw(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&_w(e,i,o),o};const hp=class extends J{constructor(){super(...arguments),this._filteredData=[],this.headersHidden=!1,this.minColWidth="4rem",this._columns=[],this._textDelimiters={comma:",",tab:"	"},this._queryString=null,this._data=[],this.expanded=!1,this.preserveStructureOnFilter=!1,this.indentationInText=!1,this.dataTransform={},this.selectableRows=!1,this.selection=new Set,this.noIndentation=!1,this.noCarets=!1,this.loading=!1,this._errorLoading=!1,this._onColumnsHidden=new Event("columnshidden"),this._hiddenColumns=[],this.defaultContentTemplate=t=>w`<bim-label style="white-space: normal;">${t}</bim-label>`,this._stringFilterFunction=(t,e)=>Object.values(e.data).some(i=>String(i).toLowerCase().includes(t.toLowerCase())),this._queryFilterFunction=(t,e)=>{let i=!1;const n=oa(t)??[];for(const o of n){if("queries"in o){i=!1;break}const{condition:r,value:s}=o;let{key:a}=o;if(a.startsWith("[")&&a.endsWith("]")){const l=a.replace("[","").replace("]","");a=l,i=Object.keys(e.data).filter(c=>c.includes(l)).map(c=>cd(e.data[c],r,s)).some(c=>c)}else i=cd(e.data[a],r,s);if(!i)break}return i}}set columns(t){const e=[];for(const i of t){const n=typeof i=="string"?{name:i,width:`minmax(${this.minColWidth}, 1fr)`}:i;e.push(n)}this._columns=e,this.computeMissingColumns(this.data),this.dispatchEvent(new Event("columnschange"))}get columns(){return this._columns}get _headerRowData(){const t={};for(const e of this.columns){const{name:i}=e;t[i]=String(i)}return t}get value(){return this._filteredData}set queryString(t){this.toggleAttribute("data-processing",!0),this._queryString=t&&t.trim()!==""?t.trim():null,this.updateFilteredData(),this.toggleAttribute("data-processing",!1)}get queryString(){return this._queryString}set data(t){this._data=t,this.updateFilteredData(),this.computeMissingColumns(t)&&(this.columns=this._columns)}get data(){return this._data}get dataAsync(){return new Promise(t=>{setTimeout(()=>{t(this.data)})})}set hiddenColumns(t){this._hiddenColumns=t,setTimeout(()=>{this.dispatchEvent(this._onColumnsHidden)})}get hiddenColumns(){return this._hiddenColumns}updateFilteredData(){this.queryString?(oa(this.queryString)?(this.filterFunction=this._queryFilterFunction,this._filteredData=this.filter(this.queryString)):(this.filterFunction=this._stringFilterFunction,this._filteredData=this.filter(this.queryString)),this.preserveStructureOnFilter&&(this._expandedBeforeFilter===void 0&&(this._expandedBeforeFilter=this.expanded),this.expanded=!0)):(this.preserveStructureOnFilter&&this._expandedBeforeFilter!==void 0&&(this.expanded=this._expandedBeforeFilter,this._expandedBeforeFilter=void 0),this._filteredData=this.data)}computeMissingColumns(t){let e=!1;for(const i of t){const{children:n,data:o}=i;for(const r in o)this._columns.map(s=>typeof s=="string"?s:s.name).includes(r)||(this._columns.push({name:r,width:`minmax(${this.minColWidth}, 1fr)`}),e=!0);if(n){const r=this.computeMissingColumns(n);r&&!e&&(e=r)}}return e}generateText(t="comma",e=this.value,i="",n=!0){const o=this._textDelimiters[t];let r="";const s=this.columns.map(a=>a.name);if(n){this.indentationInText&&(r+=`Indentation${o}`);const a=`${s.join(o)}
`;r+=a}for(const[a,l]of e.entries()){const{data:c,children:d}=l,u=this.indentationInText?`${i}${a+1}${o}`:"",h=s.map(m=>c[m]??""),p=`${u}${h.join(o)}
`;r+=p,d&&(r+=this.generateText(t,l.children,`${i}${a+1}.`,!1))}return r}get csv(){return this.generateText("comma")}get tsv(){return this.generateText("tab")}applyDataTransform(t){const e={};if(!t)return e;const{data:i}=t.data;for(const o of Object.keys(this.dataTransform)){const r=this.columns.find(s=>s.name===o);r&&r.forceDataTransform&&(o in i||(i[o]=""))}const n=i;for(const o in n){const r=this.dataTransform[o];r?e[o]=r(n[o],i,t):e[o]=i[o]}return e}downloadData(t="BIM Table Data",e="json"){let i=null;if(e==="json"&&(i=new File([JSON.stringify(this.value,void 0,2)],`${t}.json`)),e==="csv"&&(i=new File([this.csv],`${t}.csv`)),e==="tsv"&&(i=new File([this.tsv],`${t}.tsv`)),!i)return;const n=document.createElement("a");n.href=URL.createObjectURL(i),n.download=i.name,n.click(),URL.revokeObjectURL(n.href)}getRowIndentation(t,e=this.value,i=0){for(const n of e){if(n.data===t)return i;if(n.children){const o=this.getRowIndentation(t,n.children,i+1);if(o!==null)return o}}return null}getGroupIndentation(t,e=this.value,i=0){for(const n of e){if(n===t)return i;if(n.children){const o=this.getGroupIndentation(t,n.children,i+1);if(o!==null)return o}}return null}connectedCallback(){super.connectedCallback(),this.dispatchEvent(new Event("connected"))}disconnectedCallback(){super.disconnectedCallback(),this.dispatchEvent(new Event("disconnected"))}async loadData(t=!1){if(this._filteredData.length!==0&&!t||!this.loadFunction)return!1;this.loading=!0;try{const e=await this.loadFunction();return this.data=e,this.loading=!1,this._errorLoading=!1,!0}catch(e){if(this.loading=!1,this._filteredData.length!==0)return!1;const i=this.querySelector("[slot='error-loading']"),n=i?.querySelector("[data-table-element='error-message']");return e instanceof Error&&n&&e.message.trim()!==""&&(n.textContent=e.message),this._errorLoading=!0,!1}}filter(t,e=this.filterFunction??this._stringFilterFunction,i=this.data){const n=[];for(const o of i)if(e(t,o)){if(this.preserveStructureOnFilter){const r={data:o.data};if(o.children){const s=this.filter(t,e,o.children);s.length&&(r.children=s)}n.push(r)}else if(n.push({data:o.data}),o.children){const r=this.filter(t,e,o.children);n.push(...r)}}else if(o.children){const r=this.filter(t,e,o.children);this.preserveStructureOnFilter&&r.length?n.push({data:o.data,children:r}):n.push(...r)}return n}get _missingDataElement(){return this.querySelector("[slot='missing-data']")}render(){if(this.loading)return pw();if(this._errorLoading)return w`<slot name="error-loading"></slot>`;if(this._filteredData.length===0&&this._missingDataElement)return w`<slot name="missing-data"></slot>`;const t=i=>{if(!i)return;const n=i;n.table=this,n.data=this._headerRowData},e=i=>{if(!i)return;const n=i;n.table=this,n.data=this.value,n.requestUpdate()};return w`
      <div class="parent">
        ${fw()}
        ${Hi(!this.headersHidden,()=>w`<bim-table-row is-header style="grid-area: Header; position: sticky; top: 0; z-index: 5" ${me(t)}></bim-table-row>`)} 
        <div style="overflow-x: hidden; grid-area: Body">
          <bim-table-children ${me(e)} style="grid-area: Body; background-color: transparent"></bim-table-children>
        </div>
      </div>
    `}};hp.styles=[Qt.scrollbar,ee`
      :host {
        position: relative;
        overflow: auto;
        display: block;
        pointer-events: auto;
      }

      :host(:not([data-processing])) .loader {
        display: none;
      }

      .parent {
        display: grid;
        grid-template:
          "Header" auto
          "Processing" auto
          "Body" 1fr
          "Footer" auto;
        overflow: auto;
        height: 100%;
      }

      .parent > bim-table-row[is-header] {
        color: var(--bim-table_header--c, var(--bim-ui_bg-contrast-100));
        background-color: var(
          --bim-table_header--bgc,
          var(--bim-ui_bg-contrast-20)
        );
      }

      .controls {
        display: flex;
        gap: 0.375rem;
        flex-wrap: wrap;
        margin-bottom: 0.5rem;
      }
    `];let He=hp;Qe([ki()],He.prototype,"_filteredData",2);Qe([x({type:Boolean,attribute:"headers-hidden",reflect:!0})],He.prototype,"headersHidden",2);Qe([x({type:String,attribute:"min-col-width",reflect:!0})],He.prototype,"minColWidth",2);Qe([x({type:Array,attribute:!1})],He.prototype,"columns",1);Qe([x({type:Array,attribute:!1})],He.prototype,"data",1);Qe([x({type:Boolean,reflect:!0})],He.prototype,"expanded",2);Qe([x({type:Boolean,reflect:!0,attribute:"selectable-rows"})],He.prototype,"selectableRows",2);Qe([x({attribute:!1})],He.prototype,"selection",2);Qe([x({type:Boolean,attribute:"no-indentation",reflect:!0})],He.prototype,"noIndentation",2);Qe([x({type:Boolean,attribute:"no-carets",reflect:!0})],He.prototype,"noCarets",2);Qe([x({type:Boolean,reflect:!0})],He.prototype,"loading",2);Qe([ki()],He.prototype,"_errorLoading",2);var Ew=Object.defineProperty,Sw=Object.getOwnPropertyDescriptor,Sn=(t,e,i,n)=>{for(var o=n>1?void 0:n?Sw(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&Ew(e,i,o),o};const pp=class extends J{constructor(){super(...arguments),this._switchers=[],this.bottom=!1,this.switchersHidden=!1,this.floating=!1,this.switchersFull=!1,this.onTabHiddenChange=t=>{const e=t.target;e instanceof Pe&&!e.hidden&&(e.removeEventListener("hiddenchange",this.onTabHiddenChange),this.tab=e.name,e.addEventListener("hiddenchange",this.onTabHiddenChange))}}set tab(t){this._tab=t;const e=[...this.children],i=e.find(n=>n instanceof Pe&&n.name===t);for(const n of e){if(!(n instanceof Pe))continue;n.hidden=i!==n;const o=this.getTabSwitcher(n.name);o&&o.toggleAttribute("data-active",!n.hidden)}i||(this._tab="hidden",this.setAttribute("tab","hidden"))}get tab(){return this._tab}getTabSwitcher(t){return this._switchers.find(e=>e.getAttribute("data-name")===t)}createSwitchers(){this._switchers=[];for(const t of this.children){if(!(t instanceof Pe))continue;const e=document.createElement("div");e.addEventListener("click",()=>{this.tab===t.name?this.toggleAttribute("tab",!1):this.tab=t.name,this.setAnimatedBackgound()}),e.setAttribute("data-name",t.name),e.className="switcher";const i=document.createElement("bim-label");i.textContent=t.label??null,i.icon=t.icon,e.append(i),this._switchers.push(e)}}updateSwitchers(){for(const t of this.children){if(!(t instanceof Pe))continue;const e=this._switchers.find(n=>n.getAttribute("data-name")===t.name);if(!e)continue;const i=e.querySelector("bim-label");i&&(i.textContent=t.label??null,i.icon=t.icon)}}onSlotChange(t){this.createSwitchers();const e=t.target.assignedElements(),i=e.find(n=>n instanceof Pe?this.tab?n.name===this.tab:!n.hidden:!1);i&&i instanceof Pe&&(this.tab=i.name);for(const n of e){if(!(n instanceof Pe)){n.remove();continue}n.removeEventListener("hiddenchange",this.onTabHiddenChange),i!==n&&(n.hidden=!0),n.addEventListener("hiddenchange",this.onTabHiddenChange)}}doubleRequestAnimationFrames(t){requestAnimationFrame(()=>requestAnimationFrame(t))}setAnimatedBackgound(t=!1){var e;const i=this.renderRoot.querySelector(".animated-background"),n=[...((e=this.renderRoot.querySelector(".switchers"))==null?void 0:e.querySelectorAll(".switcher"))||[]].filter(o=>o.hasAttribute("data-active"))[0];requestAnimationFrame(()=>{var o,r,s,a;const l=(a=(s=(r=(o=n?.parentElement)==null?void 0:o.shadowRoot)==null?void 0:r.querySelector("bim-input"))==null?void 0:s.shadowRoot)==null?void 0:a.querySelector(".input"),c={width:n?.clientWidth,height:n?.clientHeight,top:(n?.offsetTop??0)-(l?.offsetTop??0),left:(n?.offsetLeft??0)-(l?.offsetLeft??0)};n?(i?.style.setProperty("width",`${c.width}px`),i?.style.setProperty("height",`${c.height}px`),i?.style.setProperty("left",`${c.left}px`)):i?.style.setProperty("width","0"),this.bottom?(i?.style.setProperty("top","100%"),i?.style.setProperty("transform","translateY(-100%)")):i?.style.setProperty("top",`${c.top}px`)}),t&&this.doubleRequestAnimationFrames(()=>{const o="ease";i?.style.setProperty("transition",`width ${.3}s ${o}, height ${.3}s ${o}, top ${.3}s ${o}, left ${.3}s ${o}`)})}firstUpdated(){requestAnimationFrame(()=>{this.setAnimatedBackgound(!0)}),new ResizeObserver(()=>{this.setAnimatedBackgound()}).observe(this)}render(){return w`
      <div class="parent">
        <div class="switchers">
          <div class="animated-background"></div>
          ${this._switchers}
        </div>
        <div class="content">
          <slot @slotchange=${this.onSlotChange}></slot>
        </div>
      </div>
    `}};pp.styles=[Qt.scrollbar,ee`
      * {
        box-sizing: border-box;
      }

      :host {
        background-color: var(--bim-ui_bg-base);
        display: block;
        overflow: auto;
      }

      .parent {
        display: grid;
        overflow: hidden;
        position: relative;
        grid-template: "switchers" auto "content" 1fr;
        height: 100%;
      }

      :host([bottom]) .parent {
        grid-template: "content" 1fr "switchers" auto;
      }

      .switchers {
        position: relative;
        display: flex;
        height: 2.25rem;
        font-weight: 600;
        grid-area: switchers;
      }

      .switcher {
        --bim-label--c: var(--bim-ui_bg-contrast-80);
        background-color: transparent;
        position: relative;
        cursor: pointer;
        pointer-events: auto;
        padding: 0rem 0.75rem;
        display: flex;
        justify-content: center;
        z-index: 2;
        transition: all 0.15s;
      }

      .switcher:not([data-active]):hover {
        filter: brightness(150%);
      }

      :host([switchers-full]) .switcher {
        flex: 1;
      }

      .switcher[data-active] {
        --bim-label--c: var(--bim-ui_main-contrast);
      }

      .switchers bim-label {
        pointer-events: none;
      }

      :host([switchers-hidden]) .switchers {
        display: none;
      }

      .content {
        position: relative;
        display: grid;
        grid-template-columns: 1fr;
        grid-area: content;
        max-height: 100vh;
        overflow: auto;
        transition: max-height 0.2s;
      }

      :host([tab="hidden"]) .content {
        max-height: 0;
      }

      .animated-background {
        position: absolute;
        background: var(--bim-ui_main-base);
        width: 0;
        height: 0;
        top: 0;
        left: 0;
      }

      :host(:not([bottom])) .content {
        border-top: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([bottom]) .content {
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating]) {
        background-color: transparent;
      }

      :host([floating]) .switchers {
        justify-self: center;
        overflow: hidden;
        background-color: var(--bim-ui_bg-base);
      }

      :host([floating]:not([bottom])) .switchers {
        border-radius: var(--bim-ui_size-2xs) var(--bim-ui_size-2xs) 0 0;
        border-top: 1px solid var(--bim-ui_bg-contrast-20);
        border-left: 1px solid var(--bim-ui_bg-contrast-20);
        border-right: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating][bottom]) .switchers {
        border-radius: 0 0 var(--bim-ui_size-2xs) var(--bim-ui_size-2xs);
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
        border-left: 1px solid var(--bim-ui_bg-contrast-20);
        border-right: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating][tab="hidden"]) .switchers {
        border-radius: var(--bim-ui_size-2xs);
        border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating][bottom][tab="hidden"]) .switchers {
        border-top: 1px solid var(--bim-ui_bg-contrast-20);
      }

      :host([floating]) .content {
        border: 1px solid var(--bim-ui_bg-contrast-20);
        border-radius: var(--bim-ui_size-2xs);
        background-color: var(--bim-ui_bg-base);
      }
    `];let It=pp;Sn([ki()],It.prototype,"_switchers",2);Sn([x({type:Boolean,reflect:!0})],It.prototype,"bottom",2);Sn([x({type:Boolean,attribute:"switchers-hidden",reflect:!0})],It.prototype,"switchersHidden",2);Sn([x({type:Boolean,reflect:!0})],It.prototype,"floating",2);Sn([x({type:String,reflect:!0})],It.prototype,"tab",1);Sn([x({type:Boolean,attribute:"switchers-full",reflect:!0})],It.prototype,"switchersFull",2);var Aw=Object.defineProperty,Cw=Object.getOwnPropertyDescriptor,Qr=(t,e,i,n)=>{for(var o=n>1?void 0:n?Cw(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&Aw(e,i,o),o};const fp=class extends J{constructor(){super(...arguments),this._defaultName="__unnamed__",this.name=this._defaultName,this._hidden=!1}set label(t){this._label=t;const e=this.parentElement;e instanceof It&&e.updateSwitchers()}get label(){return this._label}set icon(t){this._icon=t;const e=this.parentElement;e instanceof It&&e.updateSwitchers()}get icon(){return this._icon}set hidden(t){this._hidden=t,this.dispatchEvent(new Event("hiddenchange"))}get hidden(){return this._hidden}connectedCallback(){super.connectedCallback();const{parentElement:t}=this;if(t&&this.name===this._defaultName){const e=[...t.children].indexOf(this);this.name=`${this._defaultName}${e}`}}render(){return w` <slot></slot> `}};fp.styles=ee`
    :host {
      display: block;
      height: 100%;
      grid-row-start: 1;
      grid-column-start: 1;
      animation: openAnim 3s forwards;
      transform: translateY(0);
      max-height: 100vh;
      transition:
        opacity 0.3s ease,
        max-height 0.6s ease,
        transform 0.3s ease;
    }

    :host([hidden]) {
      transform: translateY(-20px);
      max-height: 0;
      opacity: 0;
      overflow: hidden;
      visibility: hidden;
    }
  `;let Pe=fp;Qr([x({type:String,reflect:!0})],Pe.prototype,"name",2);Qr([x({type:String,reflect:!0})],Pe.prototype,"label",1);Qr([x({type:String,reflect:!0})],Pe.prototype,"icon",1);Qr([x({type:Boolean,reflect:!0})],Pe.prototype,"hidden",1);var kw=Object.defineProperty,Tw=Object.getOwnPropertyDescriptor,ct=(t,e,i,n)=>{for(var o=n>1?void 0:n?Tw(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&kw(e,i,o),o};const mp=class extends J{constructor(){super(...arguments),this._inputTypes=["date","datetime-local","email","month","password","search","tel","text","time","url","week","area"],this.value="",this.vertical=!1,this.disabled=!1,this.resize="vertical",this._type="text",this.onValueChange=new Event("input")}set type(t){this._inputTypes.includes(t)&&(this._type=t)}get type(){return this._type}get query(){return oa(this.value)}onInputChange(t){t.stopPropagation();const e=t.target;clearTimeout(this._debounceTimeoutID),this._debounceTimeoutID=setTimeout(()=>{this.value=e.value,this.dispatchEvent(this.onValueChange)},this.debounce)}focus(){setTimeout(()=>{var t;const e=(t=this.shadowRoot)==null?void 0:t.querySelector("input");e?.focus()})}render(){return w`
      <bim-input
        .name=${this.name}
        .icon=${this.icon}
        .label=${this.label}
        .vertical=${this.vertical}
      >
        ${this.type==="area"?w` <textarea
              aria-label=${this.label||this.name||"Text Input"}
              .value=${this.value}
              .rows=${this.rows??5}
              ?disabled=${this.disabled}
              placeholder=${sa(this.placeholder)}
              @input=${this.onInputChange}
              style="resize: ${this.resize};"
            ></textarea>`:w` <input
              aria-label=${this.label||this.name||"Text Input"}
              .type=${this.type}
              .value=${this.value}
              ?disabled=${this.disabled}
              placeholder=${sa(this.placeholder)}
              @input=${this.onInputChange}
            />`}
      </bim-input>
    `}};mp.styles=[Qt.scrollbar,ee`
      :host {
        --bim-input--bgc: var(--bim-ui_bg-contrast-20);
        flex: 1;
        display: block;
      }

      input,
      textarea {
        font-family: inherit;
        background-color: transparent;
        border: none;
        width: 100%;
        padding: var(--bim-ui_size-3xs);
        color: var(--bim-text-input--c, var(--bim-ui_bg-contrast-100));
      }

      input {
        outline: none;
        height: 100%;
        padding: 0 var(--bim-ui_size-3xs); /* Override padding */
        border-radius: var(--bim-text-input--bdrs, var(--bim-ui_size-4xs));
      }

      :host([disabled]) input,
      :host([disabled]) textarea {
        color: var(--bim-ui_bg-contrast-60);
      }

      textarea {
        line-height: 1.1rem;
        outline: none;
      }

      :host(:focus) {
        --bim-input--olc: var(--bim-ui_accent-base);
      }

      /* :host([disabled]) {
      --bim-input--bgc: var(--bim-ui_bg-contrast-20);
    } */
    `];let Oe=mp;ct([x({type:String,reflect:!0})],Oe.prototype,"icon",2);ct([x({type:String,reflect:!0})],Oe.prototype,"label",2);ct([x({type:String,reflect:!0})],Oe.prototype,"name",2);ct([x({type:String,reflect:!0})],Oe.prototype,"placeholder",2);ct([x({type:String,reflect:!0})],Oe.prototype,"value",2);ct([x({type:Boolean,reflect:!0})],Oe.prototype,"vertical",2);ct([x({type:Number,reflect:!0})],Oe.prototype,"debounce",2);ct([x({type:Number,reflect:!0})],Oe.prototype,"rows",2);ct([x({type:Boolean,reflect:!0})],Oe.prototype,"disabled",2);ct([x({type:String,reflect:!0})],Oe.prototype,"resize",2);ct([x({type:String,reflect:!0})],Oe.prototype,"type",1);var Ow=Object.defineProperty,Iw=Object.getOwnPropertyDescriptor,bp=(t,e,i,n)=>{for(var o=n>1?void 0:n?Iw(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&Ow(e,i,o),o};const gp=class extends J{constructor(){super(...arguments),this.rows=2,this._vertical=!1}set vertical(t){this._vertical=t,this.updateChildren()}get vertical(){return this._vertical}updateChildren(){const t=this.children;for(const e of t)this.vertical?e.setAttribute("label-hidden",""):e.removeAttribute("label-hidden")}render(){return w`
      <style>
        .parent {
          grid-auto-flow: ${this.vertical?"row":"column"};
          grid-template-rows: repeat(${this.rows}, 1fr);
        }
      </style>
      <div class="parent">
        <slot @slotchange=${this.updateChildren}></slot>
      </div>
    `}};gp.styles=ee`
    .parent {
      display: grid;
      gap: 0.25rem;
    }

    ::slotted(bim-button[label]:not([vertical])) {
      --bim-button--jc: flex-start;
    }

    ::slotted(bim-button) {
      --bim-label--c: var(--bim-ui_bg-contrast-80);
    }
  `;let es=gp;bp([x({type:Number,reflect:!0})],es.prototype,"rows",2);bp([x({type:Boolean,reflect:!0})],es.prototype,"vertical",1);var Pw=Object.defineProperty,zw=Object.getOwnPropertyDescriptor,ts=(t,e,i,n)=>{for(var o=n>1?void 0:n?zw(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&Pw(e,i,o),o};const yp=class extends J{constructor(){super(...arguments),this._vertical=!1,this._labelHidden=!1}set vertical(t){this._vertical=t,this.updateChildren()}get vertical(){return this._vertical}set labelHidden(t){this._labelHidden=t,this.updateChildren()}get labelHidden(){return this._labelHidden}updateChildren(){const t=this.children;for(const e of t)e instanceof es&&(e.vertical=this.vertical),e.toggleAttribute("label-hidden",this.vertical)}render(){return w`
      <div class="parent">
        <div class="children">
          <slot @slotchange=${this.updateChildren}></slot>
        </div>
        ${!this.labelHidden&&(this.label||this.icon)?w`<bim-label .icon=${this.icon}>${this.label}</bim-label>`:null}
      </div>
    `}};yp.styles=ee`
    :host {
      --bim-label--fz: var(--bim-ui_size-xs);
      --bim-label--c: var(--bim-ui_bg-contrast-60);
      display: block;
      flex: 1;
    }

    :host(:not([vertical])) ::slotted(bim-button[vertical]) {
      --bim-icon--fz: var(--bim-ui_size-5xl);
      min-height: 3.75rem;
    }

    .parent {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      align-items: center;
      padding: 0.5rem;
      height: 100%;
      box-sizing: border-box;
      justify-content: space-between;
    }

    :host([vertical]) .parent {
      flex-direction: row-reverse;
    }

    :host([vertical]) .parent > bim-label {
      writing-mode: tb;
    }

    .children {
      display: flex;
      gap: 0.25rem;
    }

    :host([vertical]) .children {
      flex-direction: column;
    }
  `;let An=yp;ts([x({type:String,reflect:!0})],An.prototype,"label",2);ts([x({type:String,reflect:!0})],An.prototype,"icon",2);ts([x({type:Boolean,reflect:!0})],An.prototype,"vertical",1);ts([x({type:Boolean,attribute:"label-hidden",reflect:!0})],An.prototype,"labelHidden",1);var Lw=Object.defineProperty,Mw=Object.getOwnPropertyDescriptor,ll=(t,e,i,n)=>{for(var o=n>1?void 0:n?Mw(e,i):e,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=(n?s(e,i,o):s(o))||o);return n&&o&&Lw(e,i,o),o};const vp=class extends J{constructor(){super(...arguments),this.labelsHidden=!1,this._vertical=!1,this._hidden=!1}set vertical(t){this._vertical=t,this.updateSections()}get vertical(){return this._vertical}set hidden(t){this._hidden=t,this.dispatchEvent(new Event("hiddenchange"))}get hidden(){return this._hidden}updateSections(){const t=this.children;for(const e of t)e instanceof An&&(e.labelHidden=this.vertical&&!Re.config.sectionLabelOnVerticalToolbar,e.vertical=this.vertical)}render(){return w`
      <div class="parent">
        <slot @slotchange=${this.updateSections}></slot>
      </div>
    `}};vp.styles=ee`
    :host {
      --bim-button--bgc: transparent;
      background-color: var(--bim-ui_bg-base);
      border-radius: var(--bim-ui_size-2xs);
      display: block;
    }

    :host([hidden]) {
      display: none;
    }

    .parent {
      display: flex;
      width: max-content;
      pointer-events: auto;
    }

    :host([vertical]) .parent {
      flex-direction: column;
    }

    :host([vertical]) {
      width: min-content;
      border-radius: var(--bim-ui_size-2xs);
      border: 1px solid var(--bim-ui_bg-contrast-20);
    }

    ::slotted(bim-toolbar-section:not(:last-child)) {
      border-right: 1px solid var(--bim-ui_bg-contrast-20);
      border-bottom: none;
    }

    :host([vertical]) ::slotted(bim-toolbar-section:not(:last-child)) {
      border-bottom: 1px solid var(--bim-ui_bg-contrast-20);
      border-right: none;
    }
  `;let is=vp;ll([x({type:String,reflect:!0})],is.prototype,"icon",2);ll([x({type:Boolean,attribute:"labels-hidden",reflect:!0})],is.prototype,"labelsHidden",2);ll([x({type:Boolean,reflect:!0})],is.prototype,"vertical",1);var Dw=Object.defineProperty,jw=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&Dw(e,i,o),o};const wp=class extends J{constructor(){super(),this._onResize=new Event("resize"),new ResizeObserver(()=>{setTimeout(()=>{this.dispatchEvent(this._onResize)})}).observe(this)}render(){return w`
      <div class="parent">
        <slot></slot>
      </div>
    `}};wp.styles=ee`
    :host {
      display: grid;
      min-width: 0;
      min-height: 0;
      height: 100%;
    }

    .parent {
      overflow: hidden;
      position: relative;
    }
  `;let $p=wp;jw([x({type:String,reflect:!0})],$p.prototype,"name");var Rw=Object.defineProperty,cl=(t,e,i,n)=>{for(var o=void 0,r=t.length-1,s;r>=0;r--)(s=t[r])&&(o=s(e,i,o)||o);return o&&Rw(e,i,o),o},Ee;const ns=(Ee=class extends J{constructor(){super(...arguments),this.visible=!1,this._previousContainer=null,this._showToolTip=async()=>{this.timeoutId=setTimeout(async()=>{if(this.visible=!0,!Ee.container.parentElement){const t=document.querySelector("[data-context-dialog]");t?t.append(Ee.container):document.body.append(Ee.container)}this._previousContainer=this.parentElement,Ee.container.style.top=`${window.scrollY||document.documentElement.scrollTop}px`,Ee.container.append(this),await this.computePosition()},this.timeout===void 0?800:this.timeout)},this._hideToolTip=()=>{clearTimeout(this.timeoutId),this.visible=!1,this._previousContainer&&(this._previousContainer.append(this),this._previousContainer=null),Ee.container.children.length===0&&Ee.container.parentElement&&Ee.container.remove()}}static get container(){return Ee._container||(Ee._container=document.createElement("div"),Ee._container.style.cssText=`
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        overflow: visible;
        pointer-events: none;
        z-index: 9999;
      `),Ee._container}async computePosition(){const t=this._previousContainer||this.parentElement;if(!t)return;const e=this.style.display;this.style.display="block",this.style.visibility="hidden",await new Promise(requestAnimationFrame);const{x:i,y:n}=await Xa(t,this,{placement:this.placement,middleware:[Ha(10),Wa(),Ga({padding:8}),Ya()]});Object.assign(this.style,{left:`${i}px`,top:`${n}px`,display:e,visibility:""})}connectedCallback(){super.connectedCallback();const t=this.parentElement;t&&(t.addEventListener("mouseenter",this._showToolTip),t.addEventListener("mouseleave",this._hideToolTip))}disconnectedCallback(){super.disconnectedCallback();const t=this.parentElement;t&&(t.removeEventListener("mouseenter",this._showToolTip),t.removeEventListener("mouseleave",this._hideToolTip))}render(){return w`<div><slot></slot></div>`}},Ee.styles=ee`
    :host {
      position: absolute;
      background: var(--bim-ui_bg-contrast-20, #fff);
      color: var(--bim-ui_bg-contrast-100, #000);
      border-radius: var(--bim-ui_size-4xs, 4px);
      box-shadow: 0 0 10px 3px rgba(0, 0, 0, 0.2);
      padding: 0.75rem;
      font-size: var(--bim-ui_size-xs, 0.875rem);
      display: none;
    }
    :host([visible]) {
      display: flex;
    }
  `,Ee._container=null,Ee);cl([x({type:Boolean,reflect:!0})],ns.prototype,"visible");cl([x({type:Number,reflect:!0})],ns.prototype,"timeout");cl([x({type:String,reflect:!0})],ns.prototype,"placement");let Bw=ns;const qi=(t,e)=>{const i=e[t],n=i?.name??t,o=n.trim().split(/\s+/);let r,s;return o[0]&&o[0][0]&&(r=o[0][0].toUpperCase(),o[0][1]&&(s=o[0][1].toUpperCase())),o[1]&&o[1][0]&&(s=o[1][0].toUpperCase()),w`
    <div style="display: flex; gap: 0.25rem; overflow: hidden;">
      ${!(i!=null&&i.picture)&&(r||s)?w`
        <bim-label
          style=${Ct({borderRadius:"999px",padding:"0.375rem",backgroundColor:"var(--bim-ui_bg-contrast-20)",aspectRatio:"1",fontSize:"0.7rem"})}>${r}${s}</bim-label>
        `:null}
      <bim-label .img=${i?.picture}>${n}</bim-label>
    </div>
  `},ze={users:{"jhon.doe@example.com":{name:"Jhon Doe"}},priorities:{"On hold":{icon:"flowbite:circle-pause-outline",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#767676"}},Minor:{icon:"mingcute:arrows-down-fill",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#4CAF50"}},Normal:{icon:"fa6-solid:grip-lines",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FB8C00"}},Major:{icon:"mingcute:arrows-up-fill",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FF5252"}},Critical:{icon:"ph:warning",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FB8C00"}}},statuses:{Active:{icon:"prime:circle-fill",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)"}},"In Progress":{icon:"prime:circle-fill",style:{backgroundColor:"#fa89004d","--bim-label--c":"#FB8C00","--bim-icon--c":"#FB8C00"}},"In Review":{icon:"prime:circle-fill",style:{backgroundColor:"#9c6bff4d","--bim-label--c":"#9D6BFF","--bim-icon--c":"#9D6BFF"}},Done:{icon:"prime:circle-fill",style:{backgroundColor:"#4CAF504D","--bim-label--c":"#4CAF50","--bim-icon--c":"#4CAF50"}},Closed:{icon:"prime:circle-fill",style:{backgroundColor:"#414141","--bim-label--c":"#727272","--bim-icon--c":"#727272"}}},types:{Clash:{icon:"gg:close-r",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FB8C00"}},Issue:{icon:"mdi:bug-outline",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FF5252"}},Failure:{icon:"mdi:bug-outline",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FF5252"}},Inquiry:{icon:"majesticons:comment-line",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FF5252"}},Fault:{icon:"ph:warning",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FF5252"}},Remark:{icon:"ph:note-blank-bold",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#FB8C00"}},Request:{icon:"mynaui:edit-one",style:{backgroundColor:"var(--bim-ui_bg-contrast-20)","--bim-icon--c":"#9D6BFF"}}}},Vi={padding:"0.25rem 0.5rem",borderRadius:"999px","--bim-label--c":"var(--bim-ui_bg-contrast-100)"},Nw={dueDate:t=>{if(typeof t=="string"&&t.trim()!=="")return new Date(t)},status:t=>{if(Array.isArray(t)&&t.length!==0)return t[0]},type:t=>{if(Array.isArray(t)&&t.length!==0)return t[0]},priority:t=>{if(Array.isArray(t)&&t.length!==0)return t[0]},stage:t=>{if(Array.isArray(t)&&t.length!==0)return t[0]},assignedTo:t=>{if(Array.isArray(t)&&t.length!==0)return t[0]},labels:t=>{if(Array.isArray(t))return new Set(t)}},_p=t=>{const{components:e,topic:i,value:n,onCancel:o,onSubmit:r,styles:s}=t,a=r??(()=>{}),l=e.get(Sr),c=n?.title??i?.title??zt.default.title,d=n?.status??i?.status??zt.default.status,u=n?.type??i?.type??zt.default.type,h=n?.priority??i?.priority??zt.default.priority,p=n?.assignedTo??i?.assignedTo??zt.default.assignedTo,m=n?.labels??i?.labels??zt.default.labels,g=n?.stage??i?.stage??zt.default.stage,f=n?.description??i?.description??zt.default.description,v=i!=null&&i.dueDate?i.dueDate.toISOString().split("T")[0]:null,b=new Set([...l.config.statuses]);d&&b.add(d);const y=new Set([...l.config.types]);u&&y.add(u);const $=new Set([...l.config.priorities]);h&&$.add(h);const A=new Set([...l.config.users]);p&&A.add(p);const E=new Set([...l.config.labels]);if(m)for(const I of m)E.add(I);const O=new Set([...l.config.stages]);g&&O.add(g);const D=Vs(),P=async()=>{const{value:I}=D;if(!I)return;const U=ao(I,Nw);if(i)i.set(U),await a(i);else{const te=l.create(U);await a(te)}},T=Vs(),Y=I=>{const{value:U}=T;if(!U)return;const te=I.target;U.disabled=te.value.trim()===""},B=`btn-${Re.newRandomId()}`,ae=`btn-${Re.newRandomId()}`;return w`
    <div ${me(D)} style="display: flex; flex-direction: column; gap: 0.75rem;">
      <div style="display: flex; gap: 0.375rem">
        <bim-text-input @input=${Y} vertical label="Title" name="title" .value=${c}></bim-text-input>
        ${i?w`
            <bim-dropdown vertical label="Status" name="status" required>
              ${[...b].map(I=>w`<bim-option label=${I} .checked=${d===I}></bim-option>`)}
            </bim-dropdown>`:w``}
      </div>
      <div style="display: flex; gap: 0.375rem">
        <bim-dropdown vertical label="Type" name="type" required>
          ${[...y].map(I=>w`<bim-option label=${I} .checked=${u===I}></bim-option>`)}
        </bim-dropdown>
        <bim-dropdown vertical label="Priority" name="priority">
          ${[...$].map(I=>w`<bim-option label=${I} .checked=${h===I}></bim-option>`)}
        </bim-dropdown>
      </div>
      <div style="display: flex; gap: 0.375rem">
        <bim-dropdown vertical label="Labels" name="labels" multiple>
          ${[...E].map(I=>w`<bim-option label=${I} .checked=${m?[...m].includes(I):!1}></bim-option>`)}
        </bim-dropdown>
        <bim-dropdown vertical label="Assignee" name="assignedTo">
          ${[...A].map(I=>{const U=s!=null&&s.users?s.users[I]:null,te=U?U.name:I,X=U?.picture;return w`<bim-option label=${te} value=${I} .img=${X} .checked=${p===I}></bim-option>`})}
        </bim-dropdown>
      </div>
      <div style="display: flex; gap: 0.375rem">
        <bim-text-input vertical type="date" label="Due Date" name="dueDate" .value=${v}></bim-text-input> 
        <bim-dropdown vertical label="Stage" name="stage">
          ${[...O].map(I=>w`<bim-option label=${I} .checked=${g===I}></bim-option>`)}
        </bim-dropdown>
      </div>
      <bim-text-input vertical label="Description" name="description" type="area" .value=${f??null}></bim-text-input>
      <div style="justify-content: right; display: flex; gap: 0.375rem">
        <style>
          #${ae} {
            background-color: transparent;
          }

          #${ae}:hover {
            --bim-label--c: #FF5252;
          }

          #${B}:hover {
            background-color: #329936;
          }
        </style>
        <bim-button id=${ae} style="flex: 0" @click=${o} label="Cancel"></bim-button>
        <bim-button id=${B} style="flex: 0" @click=${P} ${me(T)} label=${i?"Update Topic":"Add Topic"} icon=${i?"tabler:refresh":"mi:add"}></bim-button>
      </div>
    </div>
  `},Fw=t=>{const{components:e,modelUserData:i,worldName:n}=t;return w`
    <bim-button
      data-ui-id="import-ifc"
      label="Load IFC"
      icon="mage:box-3d-fill"
      @click=${()=>{if(!(e&&n))return;const o=[...e.get(Er).list.values()].find(s=>"name"in s&&s.name===n);if(!o)return;const r=document.createElement("input");r.type="file",r.accept=".ifc",r.onchange=async()=>{if(r.files===null||r.files.length===0)return;const s=r.files[0],a=await s.arrayBuffer(),l=new Uint8Array(a),c=s.name.replace(".ifc",""),d=e.get(nt),u=e.get(pa);u.settings.autoSetWasm=!1,u.settings.wasm={path:"https://unpkg.com/web-ifc@0.0.72/",absolute:!1};const h=await u.load(l,!0,c,{userData:i});o.scene.three.add(h.object),h.useCamera(o.camera.three),d.core.update(!0)},r.click()}}
    ></bim-button>
  `},Uw=t=>be.create(Fw,t),Hw=Object.freeze(Object.defineProperty({__proto__:null,loadIfc:Uw},Symbol.toStringTag,{value:"Module"})),qw=t=>{const{components:e,world:i}=t;return w`
    <bim-button @click=${()=>{const n=document.createElement("input");n.type="file",n.accept=".frag",n.onchange=async()=>{if(n.files===null||n.files.length===0)return;const o=n.files[0],r=await o.arrayBuffer(),s=new Uint8Array(r),a=o.name.replace(".frag",""),l=e.get(nt),c=await l.core.load(s,{modelId:a});i&&(i.scene.three.add(c.object),c.useCamera(i.camera.three),l.core.update(!0))},n.click()}}></bim-button>
  `},Vw=t=>{const e=be.create(qw,t),[i]=e;return i.label="Load FRAG",i.icon="mage:box-3d-fill",e},Gw=Object.freeze(Object.defineProperty({__proto__:null,loadFrag:Vw},Symbol.toStringTag,{value:"Module"}));({...Hw,...Gw});const aa=async(t,e)=>{const{localId:i,category:n,children:o}=e;if(n&&o){const r={data:{Name:n,modelId:t.modelId,children:JSON.stringify(o.map(s=>s.localId))}};for(const s of o){const a=await aa(t,s);a&&(r.children||(r.children=[]),r.children.push(a))}return r}if(i!==null){const r=await t.getItem(i).getAttributes();if(!r)return null;const s={data:{Name:String(r.getValue("Name")),modelId:t.modelId,localId:i}};for(const a of o??[]){const l=await aa(t,a);l&&(s.children||(s.children=[]),s.children.push(l))}return s}return null},Ww=async t=>{const e=[];for(const i of t){const n=await i.getSpatialStructure(),o=await aa(i,n);if(!o)continue;const r={data:{Name:i.modelId,modelId:i.modelId},children:[o]};e.push(r)}return e},xp=t=>{const{components:e,models:i}=t,n=t.selectHighlighterName??"select";return w`
    <bim-table @rowcreated=${o=>{o.stopImmediatePropagation();const{row:r}=o.detail,s=e.get(Cr),a=e.get(nt);r.onclick=async()=>{if(!n)return;const{data:{modelId:l,localId:c,children:d}}=r;if(!(l&&(c!==void 0||d)))return;const u=a.list.get(l);if(u){if(c!==void 0){const h=await u.getItemsChildren([c]),p={[l]:h.length!==0?new Set(h):new Set([c])};s.highlightByID(n,p,!0,!0)}else if(d){const h=JSON.parse(d),p=await u.getItemsChildren(h),m={[l]:p.length!==0?p:h};s.highlightByID(n,m,!0,!0)}}}}} @cellcreated=${({detail:o})=>{const{cell:r}=o;r.column==="Name"&&!r.rowData.Name&&(r.style.gridColumn="1 / -1")}} ${me(async o=>{if(!o)return;const r=o;r.loadFunction=async()=>new Promise(s=>{setTimeout(()=>{s(Ww(i))})}),r.loadData(!0)})} headers-hidden>
      <bim-label slot="missing-data" style="--bim-icon--c: gold" icon="ic:round-warning">
        No models available to display the spatial structure!
      </bim-label>
    </bim-table>
  `},Yw=(t,e=!0)=>{const i=be.create(xp,t),[n,o]=i;if(n.hiddenColumns=["modelId","localId","children"],n.columns=["Name"],n.headersHidden=!0,e){const{components:r}=t,s=r.get(nt);s.list.onItemSet.add(()=>o({models:s.list.values()})),s.list.onItemDeleted.add(()=>o())}return i},Xw=Object.freeze(Object.defineProperty({__proto__:null,spatialTree:Yw,spatialTreeTemplate:xp},Symbol.toStringTag,{value:"Module"}));let hi={};const dd={_category:"Category",_localId:"LocalId",_guid:"Guid"},Zw=(t,e,i,n,o,r)=>{const s={data:{type:"attribute",modelId:n,localId:o,Name:e in dd?dd[e]:e,Value:i,dataType:r}};t.children||(t.children=[]),t.children.push(s)},Ep=(t,e,i)=>{var n;t in hi||(hi[t]=new Map);const o=hi[t],r=e._localId.value;if(o.has(r))return o.get(r);const s=(n=e[i.defaultItemNameKey])==null?void 0:n.value,a=e._category.value,l={data:{modelId:t,localId:r,type:"item",Name:s?.toString().length>0?s.toString():a??String(r)}};o.set(r,l);for(const c in e){const d=e[c];if(!Array.isArray(d))Zw(l,c,d.value,t,r,d.type);else{const u={data:{Name:c,type:"relation"}};l.children||(l.children=[]),l.children.push(u);for(const h of d){const p=Ep(t,h,i);u.children||(u.children=[]),u.children.push(p)}}}return l},Jw=async(t,e,i)=>{const n=t.get(nt);Object.keys(e).length===0&&(hi={});const o=[];for(const r in e){const s=n.list.get(r);if(!s)continue;r in hi||(hi[r]=new Map);const a=hi[r],l=e[r];for(const c of l){let d=a.get(c);if(d){o.push(d);continue}const[u]=await s.getItemsData([c],i.itemsDataConfig);d=Ep(r,u,i),o.push(d)}}return o},Sp=t=>{const e={defaultItemNameKey:"Name",itemsDataConfig:{attributesDefault:!0,relationsDefault:{attributes:!1,relations:!1},relations:{IsDefinedBy:{attributes:!0,relations:!0},DefinesOcurrence:{attributes:!1,relations:!1},ContainedInStructure:{attributes:!0,relations:!0},ContainsElements:{attributes:!1,relations:!1},Decomposes:{attributes:!1,relations:!1}}},...t},{components:i,modelIdMap:n,emptySelectionWarning:o}=t,r=Object.keys(n).reduce((s,a)=>(a.includes("DELTA")||(s[a]=n[a]),s),{});return w`
    <bim-table @cellcreated=${({detail:s})=>{const{cell:a}=s,{Name:l,Value:c}=a.rowData;l&&c===void 0&&setTimeout(()=>{a.style.gridColumn="1 / -1"})}} ${me(async s=>{if(!s)return;const a=s;a.loadFunction=async()=>Jw(i,r,e),await a.loadData(!0)&&a.dispatchEvent(new Event("datacomputed"))})}>
      ${o?w`
            <bim-label slot="missing-data" style="--bim-icon--c: gold" icon="ic:round-warning">
              Select some elements to display its properties
            </bim-label>
            `:null}
      <bim-label slot="error-loading" style="--bim-icon--c: #e72e2e" icon="bxs:error-alt">
        Something went wrong with the properties
      </bim-label>
    </bim-table>
  `},Kw=new Map,Qw={METRE:"m",SQUARE_METRE:"m²",CUBIC_METRE:"m³"},e$=async(t,e)=>{const i=t.get(nt).list.get(e);if(!i)throw new Error(`ItemsDataUI: model ${e} not found.`);let n=Kw.get(i.modelId);if(!n){const[o]=Object.values(await i.getItemsOfCategories([/UNITASSIGNMENT/])).flat(),[r]=await i.getItemsData([o],{relations:{Units:{relations:!1,attributes:!0}}});if(!Array.isArray(r.Units))return[];n=r.Units}return n},t$=(t,e)=>{const{components:i}=t;e.columns=[{name:"Name",width:"12rem"}],e.hiddenColumns=["modelId","localId","Actions","type","dataType"],e.headersHidden=!0,e.dataTransform={Value:(n,o)=>{const{dataType:r,modelId:s}=o;return r?w`<bim-label ${me(async a=>{if(!(a&&s))return;const l=await e$(i,s),c=r.replace("IFC","").replace("MEASURE","UNIT"),d=l.find(h=>h.UnitType&&"value"in h.UnitType?h.UnitType.value===c:!1);if(!d||!(d.Name&&"value"in d.Name))return n;const u=`${n.toFixed(2)} ${Qw[d.Name.value]??d.Name.value}`;a.textContent=u})}></bim-label>`:n}}},i$=t=>{const e=be.create(Sp,t),[i]=e;return t$(t,i),e},n$=Object.freeze(Object.defineProperty({__proto__:null,itemsData:i$,itemsDataTemplate:Sp},Symbol.toStringTag,{value:"Module"})),Ap=t=>{const{components:e}=t,i=t.missingDataMessage??"No models has been loaded yet",n=e.get(nt),o=({detail:r})=>{const{cell:s}=r;s.style.padding="0.25rem 0"};return w`
    <bim-table ${me(async r=>{if(!r)return;const s=r,a=[];if(n.initialized)for(const[,l]of n.list){if(!l)continue;const c=await l.getMetadata(),d={data:{Name:l.modelId,modelId:l.modelId,metadata:JSON.stringify(c)}};a.push(d)}s.data=a})} @cellcreated=${o}>
      <bim-label slot="missing-data" style="--bim-icon--c: gold" icon="ic:round-warning">
        ${i}
      </bim-label>
    </bim-table>
  `},o$=(t,e)=>{const{components:i,actions:n,metaDataTags:o}=t,r=i.get(nt),s=n?.dispose??!0,a=n?.download??!0,l=n?.visibility??!0,c=o??[];e.hiddenColumns=["modelId","metadata"],e.headersHidden=!0,e.noIndentation=!0,e.dataTransform={Name:(d,u)=>{if(!r.initialized)return d;const{modelId:h,metadata:p}=u;if(!h)return d;const m=r.list.get(h);if(!m)return h;const g=[];if(p){const y=JSON.parse(p);for(const $ of c){const A=y[$];if(!(typeof A=="string"||typeof A=="boolean"||typeof A=="number"))continue;const E=w`
            <bim-label style="background-color: var(--bim-ui_main-base); padding: 0 0.25rem; color: var(--bim-ui_main-contrast); border-radius: 0.25rem;">${A}</bim-label>
            `;g.push(E)}}let f;s&&(f=w`<bim-button @click=${()=>r.core.disposeModel(m.modelId)} icon="mdi:delete"></bim-button>`);let v;l&&(v=w`<bim-button @click=${async({target:y})=>{y.loading=!0,await m.setVisible(void 0,y.hasAttribute("data-model-hidden")),await r.core.update(!0),y.toggleAttribute("data-model-hidden"),y.icon=y.hasAttribute("data-model-hidden")?"mdi:eye-off":"mdi:eye",y.loading=!1}} icon="mdi:eye"></bim-button>`);let b;return a&&(b=w`<bim-button @click=${async()=>{const y=await m.getBuffer(!1),$=new File([y],`${m.modelId}.frag`),A=document.createElement("a");A.href=URL.createObjectURL($),A.download=$.name,A.click(),URL.revokeObjectURL(A.href)}} icon="flowbite:download-solid"></bim-button>`),w`
       <div style="display: flex; flex: 1; gap: var(--bim-ui_size-4xs); justify-content: space-between; overflow: auto;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0 var(--bim-ui_size-4xs); flex-grow: 1; overflow: auto;">
          <div style="min-height: 1.75rem; overflow: auto; display: flex;">
            <bim-label style="white-space: normal;">${d}</bim-label>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: var(--bim-ui_size-4xs); overflow: auto;">
            ${g}
          </div>
        </div>
        <div style="display: flex; align-self: flex-start; flex-shrink: 0;">
          ${b}
          ${v}
          ${f}
        </div>
       </div>
      `}}},r$=(t,e=!0)=>{const i=be.create(Ap,t),[n,o]=i;if(o$(t,n),e){const{components:r}=t,s=r.get(nt),a=()=>setTimeout(()=>o());s.list.onItemSet.add(a),s.list.onItemDeleted.add(a)}return i},s$=Object.freeze(Object.defineProperty({__proto__:null,modelsList:r$,modelsListTemplate:Ap},Symbol.toStringTag,{value:"Module"})),Cp=t=>{var e;const{components:i}=t,n=t.missingDataMessage??"No viewpoints to display",o=i.get(Ar),r=((e=t.topic)==null?void 0:e.viewpoints)??o.list.keys(),s=[];for(const c of r){const d=o.list.get(c);d&&s.push(d)}const a=c=>{if(!c)return;const d=c;d.data=s.map((u,h)=>({data:{Guid:u.guid,Title:u.title??`Viewpoint ${t.topic?h+1:""}`,Actions:""}}))},l=({detail:c})=>{const{cell:d}=c;d.style.padding="0.25rem"};return w`
    <bim-table ${me(a)} @cellcreated=${l}>
      <bim-label slot="missing-data" icon="ph:warning-fill" style="--bim-icon--c: gold;">${n}</bim-label>
    </bim-table>
  `},a$=(t,e)=>{const{components:i,topic:n}=t;e.noIndentation=!0,e.headersHidden=!0,e.hiddenColumns=["Guid"],e.columns=["Title",{name:"Actions",width:"auto"}];const o={selectComponents:!0,colorizeComponent:!0,resetColors:!0,updateCamera:!0,delete:!0,unlink:!!n,...t.actions},r=i.get(Ar);e.dataTransform={Actions:(s,a)=>{const{Guid:l}=a;if(!(l&&typeof l=="string"))return s;const c=r.list.get(l);if(!c)return s;const d=async({target:b})=>{b.loading=!0,await c.go(),b.loading=!1};let u;o.selectComponents&&(u=w`
          <bim-button label="Select Components" @click=${async({target:b})=>{const y=i.get(nt),$=i.get(Cr);if(!$.isSetup)return;b.loading=!0;const A=await y.guidsToModelIdMap([...c.selectionComponents]);await $.highlightByID("select",A),b.loading=!1}}></bim-button>
        `);let h;o.colorizeComponent&&(h=w`
          <bim-button label="Colorize Components" @click=${async({target:b})=>{b.loading=!0,await c.setColorizationState(!0),b.loading=!1}}></bim-button>
        `);let p;o.resetColors&&(p=w`
          <bim-button label="Reset Colors" @click=${async({target:b})=>{b.loading=!0,await c.setColorizationState(!1),b.loading=!1}}></bim-button>
        `);let m;o.updateCamera&&(m=w`
          <bim-button label="Update Camera" @click=${()=>c.updateCamera()}></bim-button>
        `);let g;o.unlink&&(g=w`
          <bim-button label="Unlink" @click=${()=>n?.viewpoints.delete(c.guid)}></bim-button>
        `);let f;o.delete&&(f=w`
          <bim-button label="Delete" @click=${()=>{r.list.delete(c.guid),Un.removeMenus()}}></bim-button>
        `);let v;return Object.values(o).includes(!0)&&(v=w`
          <bim-button icon="prime:ellipsis-v">
            <bim-context-menu>
              ${u}
              ${h}
              ${p}
              ${m}
              ${g}
              ${f}
            </bim-context-menu>
          </bim-button>
        `),w`
        <bim-button icon="ph:eye-fill" @click=${d}></bim-button>
        ${v}
      `}}},kp=(t,e=!0)=>{const i=be.create(Cp,t),[n,o]=i;if(a$(t,n),e){const{components:r,topic:s}=t,a=r.get(Ar);a.list.onItemUpdated.add(()=>o()),a.list.onItemDeleted.add(()=>o()),a.list.onCleared.add(()=>o()),s?(s.viewpoints.onItemAdded.add(()=>o()),s.viewpoints.onItemDeleted.add(()=>o()),s.viewpoints.onCleared.add(()=>o())):a.list.onItemSet.add(()=>o())}return i},l$=Object.freeze(Object.defineProperty({__proto__:null,viewpointsList:kp,viewpointsListTemplate:Cp},Symbol.toStringTag,{value:"Module"})),Tp=t=>{const{components:e}=t,i=t.missingDataMessage??"No topics to display",n=e.get(Sr),o=t.topics??n.list.values();return w`
    <bim-table no-indentation ${me(r=>{if(!r)return;const s=r;s.data=[...o].map(a=>{var l;return{data:{Guid:a.guid,Title:a.title,Status:a.status,Description:a.description??"",Author:a.creationAuthor,Assignee:a.assignedTo??"",Date:a.creationDate.toDateString(),DueDate:((l=a.dueDate)==null?void 0:l.toDateString())??"",Type:a.type,Priority:a.priority??"",Actions:""}}})})}>
      <bim-label slot="missing-data" icon="ph:warning-fill" style="--bim-icon--c: gold;">${i}</bim-label>
    </bim-table>
  `},c$=(t,e)=>{const{dataStyles:i}=t;e.hiddenColumns.length===0&&(e.hiddenColumns=["Guid","Actions"]),e.columns=["Title"],e.dataTransform={Priority:n=>{if(typeof n!="string")return n;const o=(i?.priorities??ze.priorities)[n];return w`
            <bim-label
              .icon=${o?.icon}
              style=${Ct({...Vi,...o?.style})}
            >${n}
            </bim-label>
          `},Status:n=>{if(typeof n!="string")return n;const o=(i?.statuses??ze.statuses)[n];return w`
            <bim-label
              .icon=${o?.icon}
              style=${Ct({...Vi,...o?.style})}
            >${n}
            </bim-label>
          `},Type:n=>{if(typeof n!="string")return n;const o=(i?.types??ze.types)[n];return w`
            <bim-label
              .icon=${o?.icon}
              style=${Ct({...Vi,...o?.style})}
            >${n}
            </bim-label>
          `},Author:n=>typeof n!="string"?n:qi(n,i?.users??ze.users),Assignee:n=>typeof n!="string"?n:qi(n,i?.users??ze.users)}},Op=(t,e=!0)=>{const i=be.create(Tp,t),[n,o]=i;if(c$(t,n),e){const{components:r,topics:s}=t,a=r.get(Sr),l=()=>o();if(a.list.onItemUpdated.add(l),a.list.onItemDeleted.add(l),s)for(const c of s)c.relatedTopics.onItemAdded.add(l),c.relatedTopics.onItemDeleted.add(l),c.relatedTopics.onCleared.add(l);else a.list.onItemSet.add(l)}return i},d$=Object.freeze(Object.defineProperty({__proto__:null,topicsList:Op,topicsListTemplate:Tp},Symbol.toStringTag,{value:"Module"})),Ip=t=>{const{topic:e,styles:i,viewpoint:n}=t,o=t.missingDataMessage??"The topic has no comments";return w`
    <bim-table no-indentation ${me(r=>{if(!r)return;const s=r;let a=e.comments.values();n&&(a=[...e.comments.values()].filter(l=>l.viewpoint===n.guid)),s.data=[...a].map(l=>({data:{guid:l.guid,Comment:l.comment,author:(()=>{const c=i;if(!c)return l.author;const d=c[l.author];return d?.name??l.author})()}}))})}>
      <bim-label slot="missing-data" icon="ph:warning-fill" style="--bim-icon--c: gold;">${o}</bim-label>
    </bim-table>
  `},u$=(t,e)=>{const{topic:i,styles:n}=t,o={delete:!0,...t.actions};e.headersHidden=!0,e.hiddenColumns=["guid","author"],e.dataTransform={Comment:(r,s)=>{const{guid:a}=s;if(typeof a!="string")return r;const l=i.comments.get(a);if(!l)return r;const c=()=>{i.comments.delete(a)};let d;if(o.delete){const u=`btn-${Re.newRandomId()}`;d=w`
          <div>
            <style>
              #${u} {
                background-color: transparent;
                --bim-label--c: var(--bim-ui_bg-contrast-60)
              }
  
              #${u}:hover {
                --bim-label--c: #FF5252;
              }
            </style>
            <bim-button @click=${c} id=${u} icon="majesticons:delete-bin"></bim-button>
          </div>
        `}return w`
        <div style="display: flex; flex-direction: column; gap: 0.25rem; flex: 1">
          <div style="display: flex; justify-content: space-between;">
            <div style="display: flex; gap: 0.375rem;">
              ${qi(l.author,n??ze.users)}
              <bim-label style="color: var(--bim-ui_bg-contrast-40)">@ ${l.date.toDateString()}</bim-label>
            </div>
            ${d}
          </div>
          <bim-label style="margin-left: 1.7rem; white-space: normal">${l.comment}</bim-label>
        </div>
      `}}},Pp=(t,e=!0)=>{const i=be.create(Ip,t),[n,o]=i;if(u$(t,n),e){const{topic:r}=t,s=()=>o();r.comments.onItemSet.add(s),r.comments.onItemUpdated.add(s),r.comments.onItemDeleted.add(s),r.comments.onCleared.add(s)}return i},h$=Object.freeze(Object.defineProperty({__proto__:null,commentsList:Pp,commentsListTemplate:Ip},Symbol.toStringTag,{value:"Module"})),p$={...Xw,...n$,...s$,...l$,...d$,...h$},zp=(t,e)=>{const{showInput:i,topic:n,styles:o}=t,r={add:!0,delete:!0,...t.actions},s=`input-${Re.newRandomId()}`,a=`btn-${Re.newRandomId()}`,l=`btn-${Re.newRandomId()}`,c=()=>document.getElementById(a),d=()=>document.getElementById(s),u=()=>{const y=d();return y?y.value.trim().length>0:!1},h=()=>{e({showInput:!0})},p=()=>{const y=d(),$=u();y&&$&&(n.createComment(y.value),e({showInput:!1}))},m=()=>{e({showInput:!1})},g=()=>{const y=c();if(y){if(!d()){y.disabled=!0;return}y.disabled=!u()}},f=w`
    ${r.add?w`<bim-button @click=${h} label="Add Comment" icon="majesticons:comment-line"></bim-button>`:null}
  `,v=w`
    <bim-text-input id=${s} @input=${g} @keypress=${y=>{y.code==="Enter"&&y.ctrlKey&&p()}} type="area"></bim-text-input>

    <div style="justify-content: right; display: flex; gap: 0.375rem">
      <style>
        #${a} {
          background-color: #329936;
        }  

        #${l} {
          background-color: transparent;
        }

        #${l}:hover {
          --bim-label--c: #FF5252;
        }
      </style>

      <bim-button style="flex: 0" id=${l} @click=${m} label="Cancel"></bim-button>
      <bim-button style="flex: 0" id=${a} @click=${p} label="Accept" icon="material-symbols:check" disabled></bim-button>
    </div>
  `,[b]=Pp({topic:n,actions:r,styles:o??ze.users});return w`
    <div style="display: flex; flex-direction: column; gap: 0.5rem">
      ${b}
      ${i?v:f}
    </div>
  `},f$=t=>be.create(zp,t),m$=Object.freeze(Object.defineProperty({__proto__:null,topicComments:f$,topicCommentsSectionTemplate:zp},Symbol.toStringTag,{value:"Module"})),Lp=(t,e)=>{const{components:i,editing:n,topic:o,styles:r}=t,s={update:!0,...t.actions},a=r?.priorities??ze.priorities,l=r?.statuses??ze.statuses,c=r?.types??ze.types;let d;o!=null&&o.priority&&(d=a[o.priority]);let u;o!=null&&o.type&&(u=c[o.type]);let h;o!=null&&o.type&&(h=l[o.status]);let p,m;return n?p=_p({components:i,topic:o,styles:r,onSubmit:()=>{e({editing:!1})},onCancel:()=>{e({editing:!1})}}):m=w`
      <div>
        <bim-label>Title</bim-label>
        <bim-label style="--bim-label--c: var(--bim-ui_bg-contrast-100)">${o.title}</bim-label>
      </div>

      ${o.description?w`
            <div>
              <bim-label>Description</bim-label>
              <bim-label style="--bim-label--c: var(--bim-ui_bg-contrast-100); white-space: normal">${o.description}</bim-label>
            </div>
          `:null}

      <div style="display: flex; gap: 0.375rem">
        <bim-label>Status</bim-label>
        <bim-label .icon=${h?.icon} style=${Ct({...Vi,...h?.style})}
        >${o.status}
        </bim-label>
      </div>

      <div style="display: flex; gap: 0.375rem">
        <bim-label>Type</bim-label>
        <bim-label .icon=${u?.icon} style=${Ct({...Vi,...u?.style})}
        >${o.type}
        </bim-label>
      </div>

      ${o.priority?w`
            <div style="display: flex; gap: 0.375rem">
              <bim-label>Priority</bim-label>
              <bim-label .icon=${d?.icon} style=${Ct({...Vi,...d?.style})}
              >${o.priority}
              </bim-label>
            </div>`:null}

      <div style="display: flex; gap: 0.375rem">
        <bim-label>Author</bim-label>
        ${qi(o.creationAuthor,r?.users??ze.users)}
      </div>

      ${o.assignedTo?w`
          <div style="display: flex; gap: 0.375rem">
            <bim-label>Assignee</bim-label>
            ${qi(o.assignedTo,r?.users??ze.users)}
          </div>`:null}

      ${o.dueDate?w`
          <div style="display: flex; gap: 0.375rem">
            <bim-label>Due Date</bim-label>
            <bim-label style="--bim-label--c: var(--bim-ui_bg-contrast-100)">${o.dueDate.toDateString()}</bim-label>
          </div>`:null}

      ${o.modifiedAuthor?w`
          <div style="display: flex; gap: 0.375rem">
            <bim-label>Modified By</bim-label>
            ${qi(o.modifiedAuthor,r?.users??ze.users)}
          </div>`:null}

      ${o.modifiedDate?w`
            <div style="display: flex; gap: 0.375rem">
              <bim-label>Modified Date</bim-label>
              <bim-label style="--bim-label--c: var(--bim-ui_bg-contrast-100)">${o.modifiedDate.toDateString()}</bim-label>
            </div>`:null}

      ${o.labels.size!==0?w`
          <div style="display: flex; gap: 0.375rem">
            <bim-label>Labels</bim-label>
            <bim-label style="white-space: normal; --bim-label--c: var(--bim-ui_bg-contrast-100)">${[...o.labels].join(", ")}</bim-label>
          </div>`:null}

      ${s.update?w`
              <bim-button @click=${()=>e({editing:!0})} label="Update Information" icon="tabler:refresh"></bim-button> 
            `:null}
    `,w`
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      ${n?p:m}
    </div>
  `},b$=t=>be.create(Lp,t),g$=Object.freeze(Object.defineProperty({__proto__:null,topicInformation:b$,topicInformationSectionTemplate:Lp},Symbol.toStringTag,{value:"Module"})),Mp=(t,e)=>{const{components:i,topic:n,linking:o}=t,r=i.get(Sr),s={link:!0,...t.actions},[a,l]=Op({components:i,topics:[...n.relatedTopics].map(h=>r.list.get(h)).map(h=>h)});a.headersHidden=!0,a.hiddenColumns=["Guid","Status","Description","Author","Assignee","Date","DueDate","Type","Priority"];const c=()=>w`
      <bim-text-input placeholder="Search..." debounce="100" @input=${h=>{const p=h.target;p instanceof Oe&&(a.queryString=p.value)}}></bim-text-input> 
    `;let d,u;if(o){a.selectableRows=!0,l({topics:void 0});const h=a.data.filter(v=>{const{Guid:b}=v.data;return typeof b!="string"?!1:n.relatedTopics.has(b)}).map(v=>v.data);a.selection=new Set(h);const p=()=>{const v=[...a.selection].map(({Guid:b})=>typeof b!="string"?null:r.list.has(b)?b:null).map(b=>b);n.relatedTopics.clear(),n.relatedTopics.add(...v),e({linking:!1})},m=()=>{e({linking:!1})},g=`btn-${Re.newRandomId()}`,f=`btn-${Re.newRandomId()}`;d=w`
      <div style="display: flex; gap: 0.25rem">
        <style>
          #${g}:hover {
            background-color: #329936;
          }  

          #${f} {
            background-color: transparent;
          }

          #${f}:hover {
            --bim-label--c: #FF5252;
          }
        </style>
        ${c()}
        <div style="display: flex; justify-content: right; gap: 0.25rem">
          <bim-button id=${f} @click=${m} style="flex: 0" label="Cancel" icon="material-symbols:close"></bim-button>
          <bim-button id=${g} @click=${p} style="flex: 0" label="Accept" icon="material-symbols:check"></bim-button>
        </div>
      </div> 
    `}else{a.selectableRows=!1;const h=()=>{e({linking:!0})};u=w`
      <div style="display: flex; justify-content: right; gap: 0.25rem">
        ${c()}
        ${s.link?w`<bim-button style="flex: 0" @click=${h} icon="tabler:link"></bim-button>`:null}
      </div> 
    `}return w`
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      ${u}
      ${d}
      ${a}
    </div> 
  `},y$=t=>be.create(Mp,t),v$=Object.freeze(Object.defineProperty({__proto__:null,topicRelations:y$,topicRelationsSectionTemplate:Mp},Symbol.toStringTag,{value:"Module"})),Dp=(t,e)=>{const{components:i,topic:n,world:o,linking:r}=t,s={add:!0,link:!0,selectComponents:!0,colorizeComponent:!0,resetColors:!0,updateCamera:!0,delete:!0,unlink:!0,...t.actions},a=i.get(Ar),[l,c]=kp({components:i,topic:n,actions:s}),d=()=>w`
      <bim-text-input placeholder="Search..." debounce="100" @input=${p=>{const m=p.target;m instanceof Oe&&(l.queryString=m.value)}}></bim-text-input> 
    `;let u,h;if(r){l.selectableRows=!0,c({topic:void 0,actions:{delete:!1,updateCamera:!1,colorizeComponent:!1,resetColors:!1}});const p=l.data.filter(b=>{const{Guid:y}=b.data;return typeof y!="string"?!1:n.viewpoints.has(y)}).map(b=>b.data);l.selection=new Set(p);const m=()=>{const b=[...l.selection].map(({Guid:y})=>typeof y!="string"?null:a.list.has(y)?y:null).map(y=>y);n.viewpoints.clear(),n.viewpoints.add(...b),e({linking:!1})},g=()=>{e({linking:!1})},f=`btn-${Re.newRandomId()}`,v=`btn-${Re.newRandomId()}`;u=w`
      <div style="display: flex; gap: 0.25rem">
        <style>
          #${f}:hover {
            background-color: #329936;
          }  

          #${v} {
            background-color: transparent;
          }

          #${v}:hover {
            --bim-label--c: #FF5252;
          }
        </style>
        ${d()}
        <div style="display: flex; justify-content: right; gap: 0.25rem">
          <bim-button id=${v} @click=${g} style="flex: 0" label="Cancel" icon="material-symbols:close"></bim-button>
          <bim-button id=${f} @click=${m} style="flex: 0" label="Accept" icon="material-symbols:check"></bim-button>
        </div>
      </div> 
    `}else{l.selectableRows=!1,c({topic:n,actions:s});const p=()=>{if(!(n&&s.add&&!r))return;const v=a.create();o&&(v.world=o),n.viewpoints.add(v.guid)},m=()=>{e({linking:!0})},g=w`<bim-button style="flex: 0" @click=${p} .disabled=${!o} icon="mi:add"></bim-button>`,f=w`<bim-button style="flex: 0" @click=${m} icon="tabler:link"></bim-button>`;h=w`
      <div style="display: flex; justify-content: right; gap: 0.25rem">
        ${d()}
        <div style="display: flex; justify-content: right; gap: 0.25rem">
          ${s.add?g:null}
          ${s.link?f:null}
        </div>
      </div> 
    `}return w`
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      ${h}
      ${u}
      ${l}
    </div> 
  `},w$=t=>be.create(Dp,t),$$=Object.freeze(Object.defineProperty({__proto__:null,topicViewpoints:w$,topicViewpointsSectionTemplate:Dp},Symbol.toStringTag,{value:"Module"}));({...m$,...g$,...v$,...$$});const _$=t=>w`
    <bim-panel-section fixed label="New Topic" name="topic">
      ${_p(t)}
    </bim-panel-section>
  `,x$=t=>be.create(_$,t),E$=Object.freeze(Object.defineProperty({__proto__:null,topic:x$},Symbol.toStringTag,{value:"Module"}));({...E$});let dl=[],$s=null;const S$=co.prototype.intersectObjects,A$=co.prototype.intersectObject,ul=t=>{if(!t||t.length===0)return t;const e=t.find(i=>i.object instanceof Pt||i.object instanceof bi);if(!e)return t;try{if(e.face&&e.object.geometry){const r=e.object.geometry.attributes.position;if(r){const s=e.face.a,a=e.face.b,l=e.face.c,c=f=>{const v=new re;if(v.fromBufferAttribute(r,f),e.object instanceof bi&&e.instanceId!==void 0){const b=new un;e.object.getMatrixAt(e.instanceId,b),v.applyMatrix4(b)}return e.object.updateMatrixWorld(),v.applyMatrix4(e.object.matrixWorld),v},d=c(s),u=c(a),h=c(l);let p=null,m=1/0,g="";if([d,u,h].forEach(f=>{const v=f.distanceTo(e.point);v<m&&(m=v,p=f,g="VERTEX")}),m>.25){const f=[new ss(d,u),new ss(u,h),new ss(h,d)];let v=1/0,b=null;f.forEach(y=>{const $=new re;y.closestPointToPoint(e.point,!0,$);const A=$.distanceTo(e.point);A<v&&(v=A,b=$)}),v<.15?(p=b,m=v,g="EDGE"):p=null}p?(e.point.copy(p),window.debugSphere&&(window.debugSphere.position.copy(p),window.debugSphere.visible=!0,g==="VERTEX"?(window.debugSphere.material.color.setHex(65280),window.debugSphere.scale.set(1,1,1)):(window.debugSphere.material.color.setHex(16776960),window.debugSphere.scale.set(.5,.5,.5))),window.debugLog&&Math.random()<.05&&window.debugLog(`Snap: ${g} (${m.toFixed(3)})`)):window.debugSphere&&(window.debugSphere.visible=!1)}}}catch(i){console.error("Snap Error",i)}return t};co.prototype.intersectObjects=function(t,e,i){const n=S$.call(this,t,e,i);return ul(n)};co.prototype.intersectObject=function(t,e,i){const n=A$.call(this,t,e,i);return ul(n)};let Se=null,ge=null,_t=null,L=[],V=null;const la=[],vr=[];let ye=null;const C$=re.prototype.fromBufferAttribute;re.prototype.fromBufferAttribute=function(t,e){try{return!t||t.isBufferAttribute&&!t.array?this.set(0,0,0):C$.call(this,t,e)}catch{return this.set(0,0,0)}};const k$=bi.prototype.raycast;bi.prototype.raycast=function(t,e){try{if(!this.geometry)return;k$.call(this,t,e)}catch{}};const T$=Bt.prototype.getX;Bt.prototype.getX=function(t){if(!this.array||this.array.length===0)return 0;try{return T$.call(this,t)}catch{return 0}};const O$=Bt.prototype.getY;Bt.prototype.getY=function(t){if(!this.array||this.array.length===0)return 0;try{return O$.call(this,t)}catch{return 0}};const I$=Bt.prototype.getZ;Bt.prototype.getZ=function(t){if(!this.array||this.array.length===0)return 0;try{return I$.call(this,t)}catch{return 0}};const P$=hn.prototype.getX;hn.prototype.getX=function(t){try{return!this.data||!this.data.array?0:P$.call(this,t)}catch{return 0}};const z$=hn.prototype.getY;hn.prototype.getY=function(t){try{return!this.data||!this.data.array?0:z$.call(this,t)}catch{return 0}};const L$=hn.prototype.getZ;hn.prototype.getZ=function(t){try{return!this.data||!this.data.array?0:L$.call(this,t)}catch{return 0}};const M$=Pt.prototype.raycast;Pt.prototype.raycast=function(t,e){try{if(!this.geometry)return;M$.call(this,t,e)}catch{}};const D$=li.prototype.raycast;li.prototype.raycast=function(t,e){try{if(!this.geometry)return;D$.call(this,t,e)}catch{}};const j$=ha.prototype.raycast;ha.prototype.raycast=function(t,e){try{if(!this.geometry)return;j$.call(this,t,e)}catch{}};const jp=()=>{const t=Pt.prototype;if(t.acceleratedRaycast&&!t._patchedAcceleratedRaycast){const e=t.acceleratedRaycast;t.acceleratedRaycast=function(i,n){try{if(!this.geometry||!this.geometry.attributes.position)return;this.geometry.boundingSphere||this.geometry.computeBoundingSphere(),e.call(this,i,n)}catch{}},t._patchedAcceleratedRaycast=!0,console.log("[Fix] Patched acceleratedRaycast successfully")}};jp();setTimeout(jp,1e3);console.log("VSR_IFC Version: v2026-03-09-v33-LoadedModelsFix");const et=document.createElement("div");et.style.position="fixed";et.style.bottom="10px";et.style.right="10px";et.style.background="rgba(0, 0, 0, 0.7)";et.style.color="#00ff00";et.style.padding="5px 10px";et.style.zIndex="10000";et.style.borderRadius="4px";et.style.fontFamily="monospace";et.style.fontSize="12px";et.textContent="v2026-03-09-v33-LoadedModelsFix";document.body.appendChild(et);window.addEventListener("error",t=>{const e=document.createElement("div");e.style.position="fixed",e.style.top="10px",e.style.left="10px",e.style.background="rgba(255, 0, 0, 0.9)",e.style.color="white",e.style.padding="15px",e.style.zIndex="10000",e.style.borderRadius="5px",e.style.fontFamily="monospace",e.style.maxWidth="80%",e.style.wordBreak="break-all",e.innerHTML=`<strong>Error Critical:</strong><br>${t.message}<br><small>${t.filename}:${t.lineno}</small>`,document.body.appendChild(e),console.error("Global Error Caught:",t.error)});const se=new nf;se.meshes||(se.meshes=[]);const R$=se.get(Er),k=R$.create();k.scene=new da(se);k.scene.setup();k.scene.three.background=new Xo(2105376);const lo=document.getElementById("viewer-container");k.renderer=new fd(se,lo);k.camera=new ua(se);se.init();Mr.init();const Rp=se.get(md);Rp.create(k);const hl="./",B$=new fa(.5,32,32),N$=new gi({color:16711680,depthTest:!1,transparent:!0,opacity:.8});Se=new Pt(B$,N$);window.debugSphere=Se;Se.renderOrder=999;Se.visible=!1;k.scene.three.add(Se);lo.addEventListener("mousemove",t=>{if(!k||!k.camera||!k.scene)return;const e=lo.getBoundingClientRect(),i=(t.clientX-e.left)/e.width*2-1,n=-((t.clientY-e.top)/e.height)*2+1,o=new co;o.setFromCamera(new xr(i,n),k.camera.three);const r=[];if(k.scene.three.traverse(a=>{(a instanceof Pt||a instanceof bi)&&r.push(a)}),r.length===0)return;const s=o.intersectObjects(r,!0);s.length>0?ul([s[0]]):Se&&(Se.visible=!1)});const Lt=document.getElementById("debug-console");if(Lt){Lt.style.display="block";const t=e=>{const i=document.createElement("div");i.textContent=`[${new Date().toLocaleTimeString()}] ${e}`,Lt.appendChild(i),Lt.scrollTop=Lt.scrollHeight,Lt.children.length>20&&Lt.removeChild(Lt.firstChild)};window.debugLog=t}else window.debugLog=console.log;const F=se.get(nt);try{await F.init(`${hl}fragments/fragments.mjs`)}catch(t){throw console.error("Critical Error: Fragments init failed",t),new Error(`Fragments init failed: ${t}`)}const Rt=se.get(of),qe=se.get(rf),Bp="2026-02-27-LocalPersistence-Fix";console.warn(`VSR_IFC Version: ${Bp}`);const ud=document.getElementById("version-display");ud&&(ud.innerText=`v${Bp}`);const F$=se.get(sf),Me=F$.get(k),U$=Me.castRayToObjects.bind(Me),wr=t=>{if(!t||!t.point)return Se&&(Se.visible=!1),t;try{if(t.face&&(t.object instanceof Pt||t.object instanceof bi)){const i=t.object.geometry;if(!i||!i.attributes.position)return t;const n=i.attributes.position,o=[t.face.a,t.face.b,t.face.c],r=l=>{const c=new re;if(l>=0&&l<n.count){if(c.fromBufferAttribute(n,l),t.object instanceof bi&&t.instanceId!==void 0){const d=new un;t.object.getMatrixAt(t.instanceId,d),c.applyMatrix4(d)}t.object.updateMatrixWorld(),c.applyMatrix4(t.object.matrixWorld)}return c};let s=null,a=2;for(const l of o){const c=r(l),d=c.distanceTo(t.point);d<a&&(a=d,s=c)}s?(t.point.copy(s),typeof Se<"u"&&(Se.position.copy(s),Se.visible=!0,Se.material.color.setHex(65280),Se.scale.set(.8,.8,.8)),window.debugLog&&window.debugLog(`SNAP! Vertex (Dist: ${a.toFixed(3)})`)):typeof Se<"u"&&(Se.visible=!1)}}catch(e){console.warn("Snapping failed:",e),window.debugLog&&window.debugLog(`Snap Error: ${e}`)}return t};Me.castRayToObjects=(t,e)=>{const i=U$(t,e);return wr(i)};if(Me.castRay){const t=Me.castRay.bind(Me);Me.castRay=e=>{const i=t(e);return i&&typeof i.then=="function"?i.then(n=>wr(n)):wr(i)}}if(Me.castRayFromVector){const t=Me.castRayFromVector.bind(Me);Me.castRayFromVector=(e,i,n)=>{const o=t(e,i,n);return wr(o)}}const H$=qe.set.bind(qe);qe.set=async(t,e)=>{if(await H$(t,e),e&&Object.keys(e).length>0)qp(e,t);else if(t)for(const i in Be)delete Be[i]};const q$=qe.isolate.bind(qe);qe.isolate=async t=>{await q$(t);try{console.warn("[DEBUG] Global Isolate Triggered. Syncing hiddenItems..."),console.log("[DEBUG] Selection keys:",Object.keys(t));for(const[e,i]of F.list){const n=await i.getItemsIdsWithGeometry(),o=new Set;for(const[a,l]of Object.entries(t)){let c=a===e;if(c||(i.items&&i.items.length>0?c=i.items.some(d=>d.id===a):i.children&&i.children.length>0&&(c=i.children.some(d=>d.uuid===a))),c){console.log(`[DEBUG] Fragment ${a} belongs to model ${e}`);const d=l instanceof Set||Array.isArray(l)?l:[];for(const u of d)o.add(u)}}Be[e]||(Be[e]=new Set);const r=Be[e];r.clear();let s=0;for(const a of n)o.has(a)||(r.add(a),s++);console.log(`[DEBUG] Model ${e}: Total ${n.size}, Visible ${o.size}, Hidden ${s}`)}}catch(e){console.error("Error updating hidden items during global isolate:",e)}};const K=se.get(af);K.material=new gi({color:13621468,side:Cs,shadowSide:Cs,opacity:.2,transparent:!0});const os=se.get(lf);os.enabled=!0;os.world=k;const V$=new gi({color:13621468,side:Cs}),Np=new mf({color:3355443,linewidth:2,resolution:new xr(window.innerWidth,window.innerHeight)});window.addEventListener("resize",()=>{const t=window.innerWidth,e=window.innerHeight;Np.resolution.set(t,e)});os.styles.set("filled",{fillsMaterial:V$,linesMaterial:Np});K.onAfterCreate.add(t=>{console.log("[DEBUG] Clipper Plane Created:",t);let e="";for(const[i,n]of K.list)if(n===t){e=i;break}if(console.log("[DEBUG] Found Plane ID:",e),e)try{console.log('[DEBUG] Applying ClipStyle "filled" to all items...'),os.createFromClipping(e,{world:k,items:{all:{style:"filled"}}}),console.log("[DEBUG] ClipStyle applied successfully.")}catch(i){console.error("[DEBUG] Failed to apply ClipStyle:",i)}else console.warn("[DEBUG] Could not find Plane ID in clipper.list")});K.onAfterDelete.add(t=>{});const Le=se.get(Cr);Le.setup({world:k,select:{name:"select",material:new gi({color:13829212,depthTest:!1,opacity:.8,transparent:!0})},hover:{name:"hover",material:new gi({color:14737632,depthTest:!1,opacity:.4,transparent:!0})}});Le.enabled=!0;try{d_()}catch(t){console.error("Error setting up visibility toolbar:",t)}try{u_()}catch(t){console.error("Error setting up measurement tools:",t),console.warn("Measurement tools failed to initialize")}const Fp=se.get(pa),ca=new URL(window.location.href),G$=ca.pathname.substring(0,ca.pathname.lastIndexOf("/")+1),Up=`${ca.origin}${G$}wasm/`;console.log("[DEBUG] Computed WASM Path:",Up);console.log("[DEBUG] Cross-Origin Isolated:",window.crossOriginIsolated?"Yes":"No (SharedArrayBuffer restricted)");Fp.setup({wasm:{path:Up,absolute:!0,logLevel:2},autoSetWasm:!1,webIfc:{COORDINATE_TO_ORIGIN:!0,USE_FAST_BOOLS:!1}});window.testIFC=async()=>{try{S("Starting IFC conversion test...");const t=se.get(pa);S("Fetching temp.ifc...");const e=await fetch(`${hl}temp.ifc`);if(!e.ok)throw new Error("Failed to fetch temp.ifc");const i=await e.arrayBuffer(),n=new Uint8Array(i);S(`IFC loaded (Size: ${(n.length/1024/1024).toFixed(2)} MB). Processing...`);const o=await t.load(n,!0,"temp_model");S("IFC conversion complete!");let r=0;o.object.traverse(l=>{l.isMesh&&r++}),S(`Converted Model meshes: ${r}`),k.scene.three.add(o.object),S("Added converted model to scene");const s=new Gi().setFromObject(o.object),a=new yi;s.getBoundingSphere(a),k.camera.controls.fitToSphere(a,!0)}catch(t){S(`IFC Test Failed: ${t}`,!0),console.error(t)}};k.camera.controls.addEventListener("rest",()=>{F.core.update(!0)});function W$(t){const r=((t.split("/").pop()??t).split("?")[0].replace(/\.(ifc|frag)$/i,"").split("_")[3]??"").trim();return r?r.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()==="desagues"?"Desagües":r:"General"}const it=new Map;function S(t,e=!1){const i=document.getElementById("debug-console");if(i){const n=document.createElement("div");n.textContent=`> ${t}`,e&&(n.style.color="#ff4444"),i.appendChild(n),i.scrollTop=i.scrollHeight}e?console.error(t):console.log(t)}function Y$(t){!t||!t.items||console.log(`[DEBUG] Skipped static edge generation for ${t.uuid} (using dynamic snapping)`)}const X$="VSR_IFC_Storage",dn="models";let _s=null;function Hp(){return _s||(_s=new Promise((t,e)=>{const i=indexedDB.open(X$,1);i.onupgradeneeded=n=>{const o=n.target.result;o.objectStoreNames.contains(dn)||o.createObjectStore(dn)},i.onsuccess=()=>t(i.result),i.onerror=()=>e(i.error)})),_s}async function Z$(t,e){try{const i=await Hp();return new Promise((n,o)=>{const a=i.transaction(dn,"readwrite").objectStore(dn).put(e,t);a.onsuccess=()=>n(),a.onerror=()=>o(a.error)})}catch(i){console.warn("IndexedDB save failed:",i)}}async function J$(t){try{const e=await Hp();return new Promise((i,n)=>{const s=e.transaction(dn,"readonly").objectStore(dn).get(t);s.onsuccess=()=>i(s.result),s.onerror=()=>n(s.error)})}catch(e){console.warn("IndexedDB load failed:",e);return}}async function pl(t,e){try{S(`Fetching Fragment: ${t}`);const i=await fetch(t);if(!i.ok)throw new Error(`Failed to fetch ${t}`);let n=await i.arrayBuffer(),o=new Uint8Array(n);S(`Fetched ${(n.byteLength/1024/1024).toFixed(2)} MB`);const r=o[0]===31&&o[1]===139;S(`Compression: ${r?"GZIP":"Uncompressed"}`);let s;try{s=await F.core.load(o,{modelId:e})}catch(f){if(console.warn("Direct load failed, attempting manual decompression/handling...",f),r&&"DecompressionStream"in window)try{S("Attempting manual decompression...");const v=new DecompressionStream("gzip"),b=v.writable.getWriter();b.write(new Uint8Array(n)),b.close();const $=await new Response(v.readable).arrayBuffer(),A=new Uint8Array($);S(`Decompressed size: ${($.byteLength/1024/1024).toFixed(2)} MB`),s=await F.core.load(A,{modelId:e})}catch(v){throw new Error(`Manual decompression failed: ${v}`)}else throw f}if(!s)throw new Error("Model failed to load (undefined result)");F.groups instanceof Map?F.groups.set(s.uuid,s):F.groups&&(F.groups[s.uuid]=s),s.name=e.split("/").pop()||"Model",s.userData||(s.userData={}),s.userData.url=t,console.log(`[Viewpoints] Registered model URL for persistence: ${s.uuid} -> ${t}`),s.uuid!==e&&(s.uuid=e,console.log(`[DEBUG] Forced model UUID to match path: ${s.uuid}`)),s.useCamera(k.camera.three),k.scene.three.add(s.object),s.object.traverse(f=>{f.isMesh&&(k.meshes.add(f),se.meshes&&Array.isArray(se.meshes)&&se.meshes.push(f))}),await F.core.update(!0);let a=!1,l=!1,c=0;s.object.traverse(f=>{f.isMesh&&f.geometry&&(c++,f.geometry.attributes.normal&&(a=!0),f.geometry.attributes.position&&(l=!0))}),console.log(`%c[VERIFICATION] Model Analysis for ${e}`,"color: cyan; font-weight: bold; font-size: 14px;"),console.log(`[VERIFICATION] Meshes checked: ${c}`),console.log(`[VERIFICATION] Position (Geometry): ${l?"YES":"NO"}`),console.log(`[VERIFICATION] Normals: ${a?"YES":"NO"}`),a?(console.log("%c[VERIFICATION] Contours/Edges capability: YES (Normals found)","color: lime;"),S("Model verification: Normals found. Snapping fully enabled.")):(console.warn("[VERIFICATION] Normals MISSING. Snapping may be limited."),S("Model verification: Normals MISSING. Snapping limited.",!0)),it.set(e,s),Y$(s);const d=s;let u=d.properties&&Object.keys(d.properties).length>0,h=!1;d.data&&(d.data instanceof Map?h=d.data.size>0:h=Object.keys(d.data).length>0),S(`Model loaded. Properties: ${u}, Data: ${h}`),console.log("[DEBUG] Model Keys:",Object.keys(d));const p=t.replace(/\.frag$/i,".json");try{S(`Checking for external properties at ${p}...`);const f=await fetch(p);if(f.ok){const v=await f.json();v&&Object.keys(v).length>0&&(d.properties=v,u=!0,S(`Loaded external properties from JSON (${Object.keys(v).length} items). Overriding embedded properties.`))}else u||S(`Properties file not found at ${p} (Status: ${f.status}).`)}catch(f){console.error("Error fetching properties JSON:",f),u||S("Error loading external properties.",!0)}if((!d.types||Object.keys(d.types).length===0)&&u){S("Reconstructing model.types from properties..."),d.types={};let f=0;for(const v in d.properties){const b=d.properties[v];if(b&&b.type){const y=b.type;d.types[y]||(d.types[y]=[]),d.types[y].push(Number(v)),f++}}S(`Reconstructed ${Object.keys(d.types).length} types covering ${f} items.`)}if(!u&&(console.warn("[DEBUG] Model has no properties attached! attempting to check data..."),!d.properties||Object.keys(d.properties).length===0))try{S("Generating dummy properties for missing metadata...");const f=await s.getItemsIdsWithGeometry(),v={};for(const b of f)v[b]={expressID:b,type:4065,GlobalId:{type:1,value:`generated-${b}`},Name:{type:1,value:`Element ${b}`}};d.properties=v,u=!0,S(`Generated fallback properties for ${f.length} items.`)}catch(f){S(`Failed to generate fallback properties: ${f}`,!0)}if(!d.data||d.data instanceof Map&&d.data.size===0){S("Reconstructing missing model.data from geometry items..."),d.data||(d.data=new Map);let f=!1;if(d.keyFragments&&d.keyFragments instanceof Map&&d.keyFragments.size>0){S(`Found keyFragments map with ${d.keyFragments.size} entries.`);for(const[b,y]of d.keyFragments.entries())d.data.set(Number(b),[y,Number(b)]);f=!0,S("Reconstructed model.data from keyFragments.")}let v=[];if(!f)if(s.items&&Array.isArray(s.items)&&s.items.length>0?(console.log(`[DEBUG] Found ${s.items.length} fragments in model.items`),v=s.items):(console.log("[DEBUG] model.items empty or missing, traversing model.object for meshes..."),s.object&&s.object.traverse(b=>{b.isMesh&&v.push(b)}),v.length===0&&d._itemsManager&&d._itemsManager.list&&(console.log("[DEBUG] Trying to recover from _itemsManager..."),d._itemsManager.list.forEach(b=>v.push(b)))),v.length>0){S(`Found ${v.length} fragments/meshes. Scanning for items...`);let b=0;for(const y of v){let $=y.items||y.ids;if(!$&&y.fragment&&($=y.fragment.items||y.fragment.ids),!$&&y.userData&&y.userData.ids&&($=y.userData.ids),$){const A=Array.isArray($)?$:Array.from($),E=y.uuid||(y.fragment?y.fragment.uuid:null);if(A.length>0&&E)for(const O of A)d.data.set(Number(O),[E,Number(O)]),b++}else{const A=y.geometry;if(A&&A.attributes&&A.attributes.expressID){const E=A.attributes.expressID,O=E.count,D=new Set;for(let T=0;T<O;T++)D.add(E.getX(T));const P=y.uuid||(y.fragment?y.fragment.uuid:null);if(P)for(const T of D)d.data.set(Number(T),[P,Number(T)]),b++}}}if(S(`Reconstructed model.data with ${b} entries from ${v.length} fragments.`),b===0){S("WARNING: Could not find items on fragments directly. Using fallback mapping to first fragment.",!0);const y=v[0],$=y.uuid;y.ids||(y.ids=new Set),y.items||(y.items=y.ids);try{const A=await s.getItemsIdsWithGeometry();for(const E of A){const O=Number(E);d.data.has(O)||(d.data.set(O,[$,O]),y.ids.add(O),Array.isArray(y.items)&&y.items.push(O),b++)}S(`Fallback applied: Mapped ${b} items to main fragment.`)}catch(A){S(`Fallback failed: ${A}`,!0)}}if(d.data.size>0){const y=d.data.keys().next().value;console.log(`[DEBUG] Sample model.data entry: Key=${y} Val=`,d.data.get(y))}if(d.types&&Object.keys(d.types).length>0){console.log(`[DEBUG] model.types found with ${Object.keys(d.types).length} types.`);const y=new Set;for(const E in d.types){const O=d.types[E];Array.isArray(O)&&O.forEach(D=>y.add(D))}const $=new Set(d.data.keys());let A=0;for(const E of y)$.has(E)&&A++;if(console.log(`[DEBUG] Type IDs: ${y.size}, Geometry IDs: ${$.size}, Match: ${A}`),(A===0||A<y.size*.5)&&y.size>0){S(`Syncing ${y.size-A} missing items for classification...`);const E=v[0],O=E.uuid;E.ids||(E.ids=new Set),E.items||(E.items=E.ids);let D=0;for(const P of y)d.data.has(P)||(d.data.set(P,[O,P]),E.ids.add(P),Array.isArray(E.items)&&E.items.push(P),D++);S(`Sync complete: ${D} items added.`)}}}else S("Cannot reconstruct model.data: No meshes found in model.object!",!0),d._itemsManager&&console.log("[DEBUG] _itemsManager:",d._itemsManager)}console.log("[DEBUG] Fragments List Keys:",Array.from(F.list.keys()));const m=F.list.has(s.uuid);if(console.log(`[DEBUG] Model registered in fragments.list: ${m} (UUID: ${s.uuid})`),!m){console.log("[DEBUG] Manually registering model in fragments manager...");try{F.list.set(s.uuid,s),console.log("[DEBUG] Manual registration successful")}catch(f){console.error("[DEBUG] Manual registration failed:",f),S(`Warning: Failed to register model: ${f}`,!0)}}if(u)try{console.log(`[DEBUG] Running classifyByFamily() for model ${s.uuid}`),await Yo(s),await Wo(),S("Classification updated");const f=document.querySelector('.tab-btn[data-tab="classification"]');f&&(f.click(),S("Switched to Classification tab."))}catch(f){S(`Classification error: ${f}`,!0)}else{S("Skipping classification (no properties)",!0);const f=document.getElementById("classification-list");f&&(f.innerHTML='<div style="padding: 20px; text-align: center; color: #888;">Sin propiedades para clasificar</div>')}S("Model loaded successfully as Fragments");let g=0;if(s.object.traverse(f=>{f.isMesh&&g++}),S(`Model meshes: ${g}`),setTimeout(async()=>{try{const f=await s.getItemsIdsWithGeometry();S(`Deferred check - items with geometry: ${f.length}`);let v=0;s.object.traverse(b=>{b.isMesh&&v++}),S(`Deferred check - meshes in scene: ${v}`)}catch(f){S(`Deferred geometry check failed: ${f}`,!0)}},5e3),it.size===1){const f=new Gi().setFromObject(s.object),v=new yi;f.getBoundingSphere(v),S(`BBox: min(${f.min.x.toFixed(2)}, ${f.min.y.toFixed(2)}, ${f.min.z.toFixed(2)}) max(${f.max.x.toFixed(2)}, ${f.max.y.toFixed(2)}, ${f.max.z.toFixed(2)}) Radius: ${v.radius.toFixed(2)}`),v.radius>.1?(k.camera.controls.fitToSphere(v,!0),S("Camera centered on model")):S("Model bounds too small or empty - Camera not moved",!0)}return s}catch(i){throw S(`Error loading model: ${i}`,!0),console.error(i),i}}function K$(){const t=document.querySelectorAll(".tab-btn"),e=document.querySelectorAll(".tab-content");t.length===0?console.warn("No sidebar tabs found during initialization"):console.log(`Initialized ${t.length} sidebar tabs`),t.forEach(i=>{i.addEventListener("click",()=>{t.forEach(r=>r.classList.remove("active")),e.forEach(r=>{r.classList.remove("active"),r.style.display="none"}),i.classList.add("active");const n=i.getAttribute("data-tab"),o=document.getElementById(`tab-${n}`);o&&(o.classList.add("active"),o.style.display="flex")})})}const Be={};function qp(t,e){for(const i in t){let n=i;if(!F.list.has(i)){for(const[a,l]of F.list)if(l.items.some(c=>c.id===i)){n=a;break}}Be[n]||(Be[n]=new Set);const o=Be[n],r=t[i],s=r instanceof Set||Array.isArray(r)?r:[];if(e)for(const a of s)o.delete(a);else for(const a of s)o.add(a)}}async function Wo(){const t=document.getElementById("classification-list");if(!t)return;if(t.innerHTML="",!Rt||!Rt.list){console.warn("Classifier not ready");return}console.log("[DEBUG] Classifier List Keys:",Array.from(Rt.list.keys()));let e=!1;for(const[i,n]of Rt.list)n.size>0&&(e=!0),console.log(`[DEBUG] Rendering system: ${i} with ${n.size} groups`);if(!e){t.innerHTML='<div style="padding: 20px; text-align: center; color: #888;">No hay clasificación disponible</div>';return}for(const[i,n]of Rt.list){const o=document.createElement("div");o.className="classification-header",o.style.padding="10px 10px 5px 10px",o.style.fontWeight="bold",o.style.color="#e91e63",o.style.borderBottom="1px solid #eee",o.style.marginTop="10px",o.innerHTML=`<i class="fa-solid fa-tags"></i> ${i}`,t.appendChild(o);const r=document.createElement("ul");r.className="folder-items",r.style.padding="10px";for(const[s,a]of n){const l=a.map||a;n.size>0&&!l&&console.error(`[DEBUG] Missing map for ${s}`,a);const c=document.createElement("li");c.className="model-item",c.style.display="flex",c.style.justifyContent="space-between";let d=0;if(l)for(const v in l){const b=l[v];b instanceof Set?d+=b.size:Array.isArray(b)&&(d+=b.length)}const u=d>0?"1":"0.5",h="pointer";c.innerHTML=`
                <div class="model-name" style="cursor: ${h}; flex-grow: 1; opacity: ${u};"><i class="fa-solid fa-layer-group"></i> ${s} <span style="font-size: 0.8em; color: #888;">(${d})</span></div>
                <div class="visibility-toggle" style="cursor: ${h}; padding: 0 10px; opacity: ${u};" title="Toggle Visibility">
                    <i class="fa-regular fa-eye"></i>
                </div>
            `;const p=c.querySelector(".model-name"),m=c.querySelector(".visibility-toggle"),g=m?.querySelector("i");let f=!0;p?.addEventListener("click",async v=>{v.stopPropagation(),console.log(`[DEBUG] Selecting category: ${s} (Count: ${d})`),console.log(`[DEBUG] FragmentIdMap for ${s}:`,l);const b=se.get(Cr);if(l&&Object.keys(l).length>0){const y=Object.keys(l||{});console.log(`[DEBUG] Map keys: ${y.join(", ")}`);try{const $=!v.ctrlKey&&!v.metaKey,A={};let E=!1;console.log(`[DEBUG] Filtering selection for ${s}. Checking hidden items...`);for(const O in l){const D=F.list.get(O);if(D&&!D.object.visible){console.log(`[DEBUG] Skipping hidden model: ${O}`);continue}const P=l[O],T=new Set,Y=Be[O];Y?console.log(`[DEBUG] Model ${O} has ${Y.size} hidden items tracked.`):(console.warn(`[DEBUG] Model ${O} has NO hidden items tracked in hiddenItems map.`),console.log("[DEBUG] hiddenItems keys:",Object.keys(Be)));const B=P instanceof Set||Array.isArray(P)?P:[];for(const ae of B)(!Y||!Y.has(ae))&&T.add(ae);T.size>0&&(A[O]=T,E=!0)}E?(b.highlightByID("select",A,$,!0),S(`Seleccionado ${s} (${d} total, selección filtrada por visibilidad)`)):S(`No hay elementos visibles para seleccionar en ${s}`)}catch($){S(`Error seleccionando ${s}: ${$}`,!0),console.error($)}}else S(`Cannot select ${s}: No items found (Map is empty)`,!0),console.warn(`[DEBUG] Map is empty for ${s}. GroupData:`,a)}),m?.addEventListener("click",v=>{v.stopPropagation(),f=!f,console.log(`[DEBUG] Toggling visibility for ${s}: ${f}`),l&&Object.keys(l).length>0?(qe.set(f,l),qp(l,f)):console.warn(`[DEBUG] Skipping visibility toggle for ${s} - map is empty`),f?(c.classList.add("visible"),g?.classList.replace("fa-eye-slash","fa-eye"),c.style.opacity="1"):(c.classList.remove("visible"),g?.classList.replace("fa-eye","fa-eye-slash"),c.style.opacity="0.5")}),r.appendChild(c)}t.appendChild(r)}}function Q$(){const t=document.getElementById("sidebar"),e=document.getElementById("sidebar-toggle"),i=document.getElementById("sidebar-resizer");if(e&&t&&e.addEventListener("click",()=>{const o=t.classList.toggle("closed");document.body.classList.toggle("sidebar-closed",o)}),i&&t){let o=!1;i.addEventListener("mousedown",r=>{o=!0,i.classList.add("resizing"),document.body.style.cursor="ew-resize",r.preventDefault()}),document.addEventListener("mousemove",r=>{if(!o)return;const s=r.clientX;s>200&&s<800&&(t.style.width=`${s}px`)}),document.addEventListener("mouseup",()=>{o&&(o=!1,i.classList.remove("resizing"),document.body.style.cursor="default")})}const n=document.getElementById("file-input");n&&n.addEventListener("change",async o=>{const r=o.target;if(r.files&&r.files.length>0){const s=document.getElementById("loading-overlay");if(s){s.style.display="flex";const l=document.getElementById("loading-progress");l&&(l.textContent="Procesando archivo...")}const a=r.files[0];try{if(a.name.toLowerCase().endsWith(".frag")){S(`Loading fragments: ${a.name}...`);const l=URL.createObjectURL(a);S(`Saving ${a.name} to local storage...`);try{const d=await a.arrayBuffer();await Z$(a.name,d),S("Saved to local storage.")}catch(d){console.warn("Failed to save to IDB:",d)}await pl(l,a.name);const c=F.groups.get(a.name)||F.groups[a.name]||Array.from(F.groups.values()).find(d=>d.uuid===a.name);if(c){c.uuid!==a.name&&(c.uuid=a.name),c.userData||(c.userData={}),c.userData.isLocal=!1,c.userData.url=`models/${a.name}`,console.log(`[Viewpoints] Manual load: Assigned URL ${c.userData.url} to ${c.uuid}`),S(`Assigned persistence URL: ${c.userData.url}`),c.useCamera(k.camera.three),k.scene.three.add(c.object),await F.core.update(!0);const d=new Gi().setFromObject(c.object),u=new yi;d.getBoundingSphere(u),k.camera.controls.fitToSphere(u,!0);const h=c,p=h.properties&&Object.keys(h.properties).length>0;if(S(`Fragment loaded. Properties found: ${p?Object.keys(h.properties).length:0}`),p){S(`Classifying fragments: ${a.name}...`);try{await Yo(c),await Wo(),S(`Classification complete for ${a.name}`)}catch(m){S(`Classification failed: ${m}`,!0)}}else{S("WARNING: No properties found in .frag file. Generating dummy properties...",!0);try{const m=await c.getItemsIdsWithGeometry(),g={};for(const f of m)g[f]={expressID:f,type:0,GlobalId:{type:1,value:`generated-${f}`},Name:{type:1,value:`Element ${f}`},Description:{type:1,value:"Generated Property"}};h.properties=g,S(`Generated dummy properties for ${m.length} elements.`),S("Attempting classification on dummy properties..."),await Yo(c),await Wo(),S("Classification complete (fallback).")}catch(m){S(`Error generating dummy properties: ${m}`,!0)}}it.has(a.name)||it.set(a.name,c)}else throw new Error("Model loaded but not found in groups.");S(`Loaded .frag: ${a.name}`),S("Ready for Measurement.")}else{S(`Loading IFC: ${a.name}...`);const l=new Uint8Array(buffer),c=await Fp.load(l,!0,a.name);F.list.has(c.uuid)||F.list.set(c.uuid,c),c.object.parent||k.scene.three.add(c.object),S(`IFC Loaded: ${a.name}. Classifying...`);try{await Yo(c),await Wo()}catch(h){S(`Classification warning: ${h}`,!0)}const d=new Gi().setFromObject(c.object),u=new yi;d.getBoundingSphere(u),k.camera.controls.fitToSphere(u,!0),S("Ready for Measurement.")}}catch(l){S(`Error loading file: ${l}`,!0),alert(`Error loading file: ${l}`)}finally{s&&(s.style.display="none")}r.value=""}})}function e_(){const t=document.getElementById("theme-toggle"),e=t?.querySelector("i"),i=document.getElementById("logo-img"),o=localStorage.getItem("theme")==="dark",r=s=>{s?(document.body.classList.add("dark-mode"),e&&(e.className="fa-solid fa-sun"),i&&(i.src="https://i.postimg.cc/0yDgcyBp/Logo-transparente-blanco.png"),k&&k.scene&&k.scene.three&&(k.scene.three.background=new Xo(1973790))):(document.body.classList.remove("dark-mode"),e&&(e.className="fa-solid fa-moon"),i&&(i.src="https://i.postimg.cc/GmWLmfZZ/Logo-transparente-negro.png"),k&&k.scene&&k.scene.three&&(k.scene.three.background=new Xo(16119285)))};r(o),t?.addEventListener("click",()=>{document.body.classList.toggle("dark-mode");const s=document.body.classList.contains("dark-mode");localStorage.setItem("theme",s?"dark":"light"),r(s)})}function t_(){const t=document.getElementById("projection-toggle");if(!t)return;const e=t.querySelector("span"),i=()=>{const o=k.camera.projection?.current==="Orthographic";t.classList.toggle("active",o),e&&(e.textContent=o?"Orto":"Persp")};i(),t.addEventListener("click",()=>{const n=k.camera.projection;if(!n||typeof n.set!="function")return;const r=n.current==="Orthographic"?"Perspective":"Orthographic";n.set(r);const s=k.renderer;s?.postproduction?.updateCamera&&s.postproduction.updateCamera(),i()})}function i_(){const t=document.getElementById("clipper-toggle"),e=document.getElementById("clipper-controls"),i=document.getElementById("viewer-container");if(!t||!i)return;const n=()=>{const s=K.enabled;t.classList.toggle("active",s),e&&(e.style.display=s?"flex":"none")};n(),t.addEventListener("click",()=>{K.enabled=!K.enabled,n()}),i.addEventListener("dblclick",()=>{K.enabled&&K.create(k)}),window.addEventListener("keydown",s=>{(s.code==="Delete"||s.code==="Backspace")&&K.delete(k)});const o=document.getElementById("clipper-delete-all");o&&o.addEventListener("click",()=>{K.deleteAll()}),document.querySelectorAll(".clipper-plane-btn").forEach(s=>{s.addEventListener("click",()=>{if(!K.enabled)return;const a=s.getAttribute("data-axis"),l=Gp(),c=new re;a==="x"?c.set(-1,0,0):a==="y"?c.set(0,-1,0):a==="z"&&c.set(0,0,-1),K.createFromNormalAndCoplanarPoint(k,c,l)})})}function n_(){const t=document.getElementById("grid-toggle");t&&t.addEventListener("click",()=>{const e=Rp.list.get(k.uuid);e&&(e.visible=!e.visible,t.classList.toggle("active",e.visible))})}const xs={};async function Vp(){const t=document.getElementById("model-list");if(t)try{const e="https://api.github.com/repos/alcabama-commits/bim/contents/docs/VSR_IFC/models";S("Scanning GitHub for models...");const i=await fetch(e);if(!i.ok)throw new Error(`GitHub API Error: ${i.status}`);const n=await i.json();if(!Array.isArray(n))throw new Error("Invalid GitHub response");const o=n.filter(s=>s.name.toLowerCase().endsWith(".frag")).map(s=>({name:s.name,path:`models/${s.name}`,url:s.download_url}));S(`GitHub Scan: ${o.length} .frag models found`);const r={};o.forEach(s=>{const a=W$(s.path);r[a]||(r[a]=[]),r[a].push(s)}),window._autoUpdateStarted||(window._autoUpdateStarted=!0,setInterval(Vp,6e4),S("Auto-update enabled (60s).")),t.innerHTML="";for(const[s,a]of Object.entries(r)){const l=document.createElement("div");l.className="folder-group";const c=document.createElement("div");c.className="folder-header",c.innerHTML=`<span><i class="fa-regular fa-folder-open"></i> ${s}</span> <i class="fa-solid fa-chevron-down"></i>`;const d=document.createElement("ul");d.className="folder-items",c.addEventListener("click",()=>{d.classList.contains("collapsed")?(d.classList.remove("collapsed"),c.querySelector(".fa-chevron-right")?.classList.replace("fa-chevron-right","fa-chevron-down"),c.querySelector(".fa-folder")?.classList.replace("fa-folder","fa-folder-open"),xs[s]=!1):(d.classList.add("collapsed"),c.querySelector(".fa-chevron-down")?.classList.replace("fa-chevron-down","fa-chevron-right"),c.querySelector(".fa-folder-open")?.classList.replace("fa-folder-open","fa-folder"),xs[s]=!0)}),xs[s]&&(d.classList.add("collapsed"),c.querySelector(".fa-chevron-down")?.classList.replace("fa-chevron-down","fa-chevron-right"),c.querySelector(".fa-folder-open")?.classList.replace("fa-folder-open","fa-folder")),a.forEach(u=>{const h=document.createElement("li");h.className="model-item",h.dataset.path=u.path,(it.has(u.path)||u.url&&it.has(u.url))&&h.classList.add("visible"),h.innerHTML=`
                    <div class="model-name"><i class="fa-solid fa-cube"></i> ${u.name}</div>
                    <div class="visibility-toggle" title="Toggle Visibility">
                        <i class="fa-regular ${h.classList.contains("visible")?"fa-eye":"fa-eye-slash"}"></i>
                    </div>
                `,h.addEventListener("click",async p=>{p.stopPropagation();const m=p.target,g=u.url||u.path;m.closest(".visibility-toggle")?await r_(g,hl,h):await o_(g)}),d.appendChild(h)}),l.appendChild(c),l.appendChild(d),t.appendChild(l)}}catch(e){S(`Error loading model list: ${e}`,!0)}}async function o_(t){if(!it.has(t)){S(`Model ${t} not loaded. Click the eye icon to load it first.`,!0);return}const e=it.get(t);if(e)try{const i=await e.getItemsIdsWithGeometry(),n={};n[t]=i,S(`Selecting model: ${e.name} (${i.length} items)`),Le.highlightByID("select",n,!0,!0);const o=new Gi().setFromObject(e.object),r=new yi;o.getBoundingSphere(r),k.camera.controls.fitToSphere(r,!0)}catch(i){S(`Error selecting model: ${i}`,!0)}}async function r_(t,e,i){const n=i.querySelector(".visibility-toggle i");if(it.has(t)){const r=it.get(t),s=!r.object.visible;r.object.visible=s,s?(i.classList.add("visible"),n?.classList.replace("fa-eye-slash","fa-eye")):(i.classList.remove("visible"),n?.classList.replace("fa-eye","fa-eye-slash")),S(`Toggled model visibility: ${t} -> ${s}`);return}const o=document.getElementById("loading-overlay");o&&(o.style.display="flex");try{let r=t;if(!t.startsWith("http")){const s=t.split("/").map(a=>encodeURIComponent(a)).join("/");r=`${e}${s}`}await pl(r,t),i.classList.add("visible"),n?.classList.replace("fa-eye-slash","fa-eye")}catch(r){const s=r instanceof Error?r.message:String(r);alert("Error downloading model: "+s),S(`Error downloading model: ${s}`,!0)}finally{o&&(o.style.display="none")}}S("Initializing That Open Engine...");Q$();K$();e_();t_();n_();i_();a_();Vp();c_();const Es=document.getElementById("console-toggle");Es&&Es.addEventListener("click",()=>{const t=document.getElementById("debug-console");if(t){const e=t.style.display!=="none";t.style.display=e?"none":"block",Es.classList.toggle("active",!e)}});function fl(){const t=se.get(df);t.list.clear(),t.addFromModels();let e=t.get();return t.list.clear(),e.isEmpty()&&(console.warn("BoundingBoxer empty, falling back to scene traversal"),e=new Gi,k.scene.three.traverse(i=>{i.isMesh&&i.visible&&e.expandByObject(i)})),e}function Gp(){const t=fl();if(t.isEmpty())return new re(0,0,0);const e=new re;return t.getCenter(e),e}function s_(){const t=fl();if(t.isEmpty())return 10;const e=new yi;return t.getBoundingSphere(e),e.radius||10}function a_(){const t=document.getElementById("fit-model-btn");t&&t.addEventListener("click",()=>{S("Fit Model clicked");const e=fl(),i=new yi;e.getBoundingSphere(i),S(`Fit Radius: ${i.radius.toFixed(2)} Center: ${i.center.x.toFixed(1)},${i.center.y.toFixed(1)},${i.center.z.toFixed(1)}`),i.radius>.1?k.camera.controls.fitToSphere(i,!0):(S("Model bounds too small/empty",!0),alert("No se pudo encontrar el modelo para ajustar. Intenta recargar."))})}const $r=document.getElementById("view-dropdown-btn"),Ss=document.getElementById("view-dropdown-menu");$r&&Ss&&($r.addEventListener("click",t=>{t.stopPropagation(),Ss.classList.toggle("show")}),document.addEventListener("click",()=>{Ss.classList.remove("show")}));const l_=document.querySelectorAll(".view-btn");l_.forEach(t=>{t.addEventListener("click",async()=>{const e=t.getAttribute("data-view");if($r){const r=t.querySelector("i")?.cloneNode(!0),s=t.textContent?.trim(),a=$r.querySelector("span");a&&r&&s&&(a.innerHTML="",a.appendChild(r),a.appendChild(document.createTextNode(" "+s)))}const i=Gp(),o=s_()*2;switch(k.camera.controls.enabled=!0,e){case"top":await k.camera.controls.setLookAt(i.x,i.y+o,i.z,i.x,i.y,i.z,!0);break;case"bottom":await k.camera.controls.setLookAt(i.x,i.y-o,i.z,i.x,i.y,i.z,!0);break;case"front":await k.camera.controls.setLookAt(i.x,i.y,i.z+o,i.x,i.y,i.z,!0);break;case"back":await k.camera.controls.setLookAt(i.x,i.y,i.z-o,i.x,i.y,i.z,!0);break;case"left":await k.camera.controls.setLookAt(i.x-o,i.y,i.z,i.x,i.y,i.z,!0);break;case"right":await k.camera.controls.setLookAt(i.x+o,i.y,i.z,i.x,i.y,i.z,!0);break;case"iso":await k.camera.controls.setLookAt(i.x+o,i.y+o,i.z+o,i.x,i.y,i.z,!0);break}})});const[Wp]=p$.itemsData({components:se,modelIdMap:{}});Wp.preserveStructureOnFilter=!0;const As=document.getElementById("properties-content");As&&(As.innerHTML="",As.appendChild(Wp));Le.events.select.onHighlight.add(async t=>{console.log("[DEBUG] Highlight event:",t),await rs(t)});Le.events.select.onClear.add(async()=>{await rs({})});lo&&lo.addEventListener("click",()=>{const t=Le.selection?.select;rs(t||{})});function $t(t,e){return!t||!e||!e.properties?t:typeof t=="number"?e.properties[t]:t&&typeof t.value=="number"?e.properties[t.value]:t}async function rs(t){console.log("[DEBUG] renderPropertiesTable called with:",t);const e=document.getElementById("properties-content");if(!e)return;e.innerHTML="";const i=t instanceof Map?Array.from(t.entries()):Object.entries(t);if(i.length===0){e.innerHTML='<div style="padding: 15px; color: #666; text-align: center;">Selecciona un elemento para ver sus propiedades</div>';return}const n={};for(const[h,p]of i){const m=p instanceof Set?Array.from(p):p;!m||m.length===0||(n[h]=m)}const o=Object.keys(n);if(o.length===0){e.innerHTML='<div style="padding: 15px; color: #666; text-align: center;">Selecciona un elemento para ver sus propiedades</div>';return}const r=await F.getData(n,{attributesDefault:!0,relations:{ContainedInStructure:{attributes:!0,relations:!0},IsDefinedBy:{attributes:!0,relations:!0}}}),s={};for(const h of o){const p=r[h]||[],m=new Set;p.forEach(g=>{const f=g,v=f.data||f.attributes||f,b=f.relations||f.Relations||v.relations||v.Relations||{},y=b.ContainedInStructure||b.containedInStructure||b.containedInSpatialStructure||b.ContainedInSpatialStructure;Array.isArray(y)&&y.forEach($=>m.add($))}),m.size>0&&(s[h]=Array.from(m))}let a={};if(Object.keys(s).length>0)try{a=await F.getData(s,{attributesDefault:!0,relationsDefault:{attributes:!0}})}catch(h){console.error("Failed to fetch relations data:",h)}const l={},c={};for(const h of Object.keys(a)){const p=a[h],m=new Set;p.forEach(g=>{const f=g,v=f.data||f.attributes||f,b=v.RelatingStructure||v.relatingStructure,y=b&&typeof b=="object"&&"value"in b?b.value:b;if(typeof y=="number"){m.add(y);const $=f.expressID||v.expressID;$&&(c[`${h}-${$}`]=y)}}),m.size>0&&(l[h]=Array.from(m))}let d={};if(Object.keys(l).length>0)try{d=await F.getData(l,{attributesDefault:!0})}catch(h){console.error("Failed to fetch structure data:",h)}const u=(h,p)=>{const m=d[h];if(!m)return null;const g=m.find(b=>(b.expressID||b.attributes?.expressID||b.data?.expressID)===p);if(!g)return null;const f=g.data||g.attributes||g,v=f.Name||f.name;return v?.value??v};for(const h of o){const p=n[h]||[],m=r[h]||[],g=it.get(h)||F.list.get(h);m.forEach((f,v)=>{const b=p[v],y=f,$=y.data||y.attributes||y;let A=null;const E=$.Name||$.name||$.IFCNAME||$.IfcName,O=typeof E=="object"&&E!==null&&"value"in E?E.value:E||`Elemento ${b??""}`,D=y.category||$.Category||$.category,P=y.guid||$.GlobalId||$.globalId||$.GUID||$.guid,T=typeof P=="object"&&P!==null&&"value"in P?P.value:P||"",Y=document.createElement("div");Y.className="prop-item";let B=`
                <div class="prop-header-info">
                    <strong>${O}</strong>
                    <div style="font-size: 11px; color: #666;">
                        ID: ${b??"-"} <span style="margin: 0 5px;">|</span> Modelo: ${h}
                        ${D?`<span style="margin: 0 5px;">|</span> Tipo: ${D}</span>`:""}
                        ${T?`<br/>GUID: ${T}`:""}
                    </div>
                </div>
            `;B+='<div class="prop-set-title">Atributos Base</div>',B+='<table class="prop-table"><tbody>';const ae=new Set(["localId","category","guid","IsDefinedBy","isDefinedBy","relations","Relations","expressID","type"]);for(const[H,q]of Object.entries($)){if(!H||ae.has(H))continue;const fe=q?.value??q;fe!=null&&(Array.isArray(fe)||typeof fe!="object"&&(B+=`<tr><th>${H}</th><td>${fe}</td></tr>`))}A&&(B+=`<tr><th>Nivel</th><td>${A}</td></tr>`),B+="</tbody></table>";const I=new Set(["expressID","type","GlobalId","Name","Description","Tag","ObjectType","ContainedInStructure","containedInStructure","IsDefinedBy","isDefinedBy","relations","Relations","localId","category","guid"]);if(g&&g.properties&&g.properties[b]){let H=function(R){const j=R.Name||R.name,z=(j?.value??j)||"Sin Nombre",N=R.HasProperties||R.hasProperties;if(N&&Array.isArray(N)){B+=`<div class="prop-set-title">${z}</div><table class="prop-table"><tbody>`;for(const oe of N){const M=$t(oe,g);if(!M)continue;const Ae=M.Name||M.name,we=Ae?.value??Ae,Ce=M.NominalValue||M.nominalValue,Pi=Ce?.value??Ce;if(we&&Pi!==void 0){const Jp=ve(Pi,0);B+=`<tr><th>${we}</th><td>${Jp}</td></tr>`}}B+="</tbody></table>"}const de=R.Quantities||R.quantities;if(de&&Array.isArray(de)){B+=`<div class="prop-set-title">${z} (Cantidades)</div><table class="prop-table"><tbody>`;for(const oe of de){const M=$t(oe,g);if(!M)continue;const Ae=M.Name||M.name,we=Ae?.value??Ae,Ce=M.LengthValue?.value??M.LengthValue??M.AreaValue?.value??M.AreaValue??M.VolumeValue?.value??M.VolumeValue??M.CountValue?.value??M.CountValue??M.WeightValue?.value??M.WeightValue??M.TimeValue?.value??M.TimeValue??M.nominalValue?.value??M.nominalValue;if(we&&Ce!==void 0){const Pi=ve(Ce,0);B+=`<tr><th>${we}</th><td>${Pi}</td></tr>`}}B+="</tbody></table>"}};const q=g.properties[b];let fe=!1,dt='<div class="prop-set-title">Propiedades del Elemento (Completo)</div><table class="prop-table"><tbody>';const ve=(R,j)=>{if(j>2)return"...";if(R==null)return"";let z=R;if(typeof R=="object"&&R!==null&&R.value!==void 0&&(z=R.value),Array.isArray(z))return z.length===0?"[]":`[${z.map(N=>ve(N,j+1)).join(", ")}]`;if(typeof z=="number"&&Number.isInteger(z)){if(g.properties[z]){const N=g.properties[z],de=N.Name&&(N.Name.value||N.Name)||N.NominalValue&&(N.NominalValue.value||N.NominalValue)||N.Description&&(N.Description.value||N.Description);let oe="";if(j<1){const M=[];for(const[Ae,we]of Object.entries(N))["expressID","type","GlobalId","OwnerHistory","Owner"].includes(Ae)||typeof we=="object"||Array.isArray(we)||M.push(`${Ae}: ${we}`);M.length>0&&(oe=` <span style="color:#666; font-size:0.85em;">{${M.join(", ")}}</span>`)}return`<span title="ExpressID: ${z}" style="color: #0056b3; cursor: help;">${de||N.type||"Entity"} <i>#${z}</i>${oe}</span>`}return String(z)}if(typeof z=="object")try{return JSON.stringify(z)}catch{return"[Object]"}return String(z)},wt=(R,j,z=0)=>{if(!j||typeof j!="object"||z>2)return"";let N=`<div class="prop-set-title">${R}</div><table class="prop-table"><tbody>`;for(const[de,oe]of Object.entries(j)){let M=oe?.value??oe;if(M==null)continue;if(Array.isArray(M)){if(M.length===0)continue;const we=M[0];if(we&&typeof we=="object"&&!("value"in we)){let Ce=0;for(const Pi of M)N+=wt(`${de}[${Ce}]`,Pi,z+1),Ce++}else{const Ce=ve(M,z);N+=`<tr><th>${de}</th><td>${Ce}</td></tr>`}continue}if(typeof M=="object"){N+=wt(de,M,z+1);continue}const Ae=ve(M,z);N+=`<tr><th>${de}</th><td>${Ae}</td></tr>`}return N+="</tbody></table>",N};let tt="";for(const[R,j]of Object.entries(q)){if(I.has(R)||j==null)continue;let z=null,N=!1;if(typeof j=="string"){const oe=j.trim();if(oe.startsWith("{")||oe.startsWith("[")){console.log(`[DEBUG] Attempting to parse complex string for key '${R}'`,oe.substring(0,50)+"...");try{z=JSON.parse(oe),N=typeof z=="object"&&z!==null,console.log(`[DEBUG] Parsing success for '${R}'`,N)}catch(M){console.warn(`[DEBUG] JSON.parse failed for '${R}':`,M);try{oe.startsWith("{")&&(z=new Function("return "+oe)(),N=typeof z=="object"&&z!==null)}catch{}}}}else typeof j=="object"&&(!(j.value!==void 0&&Object.keys(j).length<=2)&&!Array.isArray(j)||Array.isArray(j)&&j.length>0&&typeof j[0]=="object")&&(z=j,N=!0);if(N&&z){if(Array.isArray(z))tt+=wt(R,z,0);else{let oe=!0;for(const M of Object.values(z))if(typeof M!="object"||M===null){oe=!1;break}if(oe)for(const[M,Ae]of Object.entries(z))tt+=wt(M,Ae,0);else tt+=wt(R,z,0)}continue}const de=ve(j,0);dt+=`<tr><th>${R}</th><td>${de}</td></tr>`,fe=!0}if(dt+="</tbody></table>",fe&&(B+=dt),B+=tt,!g._inverseMap){console.log("Building inverse attribute map for property discovery..."),g._inverseMap=new Map;const R=g._inverseMap;for(const j in g.properties){const z=g.properties[j];if(!z)continue;if(String(z.type||"").toUpperCase()==="IFCRELDEFINESBYPROPERTIES"){const de=z.RelatedObjects||z.relatedObjects,oe=z.RelatingPropertyDefinition||z.relatingPropertyDefinition;if(de&&oe){const M=Array.isArray(de)?de:[de],Ae=oe.value||oe;for(const we of M){const Ce=we.value||we;R.has(Ce)||R.set(Ce,[]),R.get(Ce).push(Ae)}}}}console.log(`Inverse map built. Found relations for ${R.size} items.`)}q.IsDefinedBy||q.isDefinedBy,g._inverseMap&&g._inverseMap.has(Number(b))&&g._inverseMap.get(Number(b)).forEach(j=>{});const ii=g._inverseMap?g._inverseMap.get(Number(b))||[]:[],le=q.ContainedInStructure||q.containedInStructure;if(le&&Array.isArray(le))for(const R of le){const j=$t(R,g);if(!j)continue;const z=j.RelatingStructure||j.relatingStructure;if(!z)continue;const N=$t(z,g);if(!N)continue;const de=N.Name||N.name,oe=(de?.value??de)||"Sin Nombre";{A=String(oe);break}}const ce=q.IsDefinedBy||q.isDefinedBy;if(ce&&Array.isArray(ce))for(const R of ce){const j=$t(R,g);if(!j)continue;const z=j.RelatingPropertyDefinition||j.relatingPropertyDefinition;if(!z)continue;const N=$t(z,g);N&&H(N)}if(ii.length>0)for(const R of ii){const j=$t(R,g);j&&H(j)}}if(!A){const H=y.relations||y.Relations||$.relations||$.Relations||{},q=H.ContainedInStructure||H.containedInStructure||H.containedInSpatialStructure||H.ContainedInSpatialStructure;if(Array.isArray(q)&&q.length>0)for(const fe of q){const dt=c[`${h}-${fe}`];if(dt){const ve=u(h,dt);if(ve){A=String(ve);break}}if(!A){const ve=$t(fe,g);if(ve&&typeof ve=="object"){const wt=ve.RelatingStructure||ve.relatingStructure,tt=$t(wt,g);if(tt&&typeof tt=="object"){const ii=tt.Name||tt.name,le=ii?.value??ii;if(le){A=String(le);break}}}}}}A&&!B.includes("<th>Nivel</th>")&&(B=B.replace("</tbody></table>",`<tr><th>Nivel</th><td>${A}</td></tr></tbody></table>`));const U=y.relations||y.Relations||$.relations||$.Relations||{},te=Object.keys(U),X=U.ContainedInStructure||U.containedInStructure||U.containedInSpatialStructure||U.ContainedInSpatialStructure;B+=`
                <details style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px;">
                    <summary style="font-size: 11px; color: #999; cursor: pointer; user-select: none;">
                        🛠 Diagnóstico de Datos
                    </summary>
                    <div style="font-size: 10px; color: #444; background: #f5f5f5; padding: 10px; margin-top: 5px; border-radius: 4px; overflow-x: auto;">
                        <strong>ID Elemento:</strong> ${b} (ExpressID)<br/>
                        <strong>Relaciones Disponibles:</strong> ${te.length>0?te.join(", "):"NINGUNA"}<br/>
                        <strong>Relación Espacial (Nivel):</strong> ${X?"✅ EXISTE":"❌ FALTA"}<br/>
                        ${X?`Valores: ${JSON.stringify(X)}`:""}
                    </div>
                </details>
            `,Y.innerHTML=B,e.appendChild(Y)})}}function c_(){const t=document.getElementById("properties-panel"),e=document.getElementById("properties-toggle"),i=document.getElementById("properties-resizer");if(e&&t&&e.addEventListener("click",()=>{t.classList.toggle("closed")}),i&&t){let n=!1;const o=t.querySelector(".properties-header");if(o&&!o.querySelector(".version-tag")){const r=document.createElement("span");r.className="version-tag",r.style.fontSize="10px",r.style.color="#888",r.style.marginLeft="10px",r.innerText="v2026-02-09-Fix-v17-EmergencyPatched",o.appendChild(r)}i.addEventListener("mousedown",r=>{n=!0,i.classList.add("resizing"),document.body.style.cursor="ew-resize",r.preventDefault()}),document.addEventListener("mousemove",r=>{if(!n)return;const s=window.innerWidth-r.clientX;s>200&&s<800&&(t.style.width=`${s}px`)}),document.addEventListener("mouseup",()=>{n&&(n=!1,i.classList.remove("resizing"),document.body.style.cursor="default")})}rs({})}async function Yo(t){if(!t.properties)return;S("Clasificando modelo por Tipo y Nivel...");const e=new Map,i=new Map,n=t.uuid,o=await t.getItemsIdsWithGeometry(),r=new Set(o),s=new Map,a=new Map,l=new Map;for(const c of o)s.set(c,"Sin Tipo"),a.set(c,"Sin Nivel"),l.set(c,0);for(const c in t.properties){const d=t.properties[c];if(d&&d.RelatedObjects&&d.RelatingPropertyDefinition){const u=d.RelatedObjects,h=d.RelatingPropertyDefinition;if(!u||!h)continue;const p=h.value||h,m=t.properties[p];if(m&&(m.HasProperties||m.hasProperties)){const g=m.HasProperties||m.hasProperties;if(!Array.isArray(g))continue;for(const f of g){const v=f.value||f,b=t.properties[v];if(!b)continue;const y=b.Name||b.name,$=y?.value??y;if($==="Familia"||$==="Family"){const A=b.NominalValue||b.nominalValue,E=A?.value??A;if(E){const O=String(E).trim(),D=Array.isArray(u)?u:[u];for(const P of D){const T=P.value||P;r.has(T)&&s.set(T,O)}}}if($==="Nivel"||$==="Nivel de referencia"||$==="Restricción de base"){const A=b.NominalValue||b.nominalValue,E=A?.value??A;if(E){const O=String(E).trim(),D=Array.isArray(u)?u:[u];let P=0;$==="Nivel"?P=3:$==="Nivel de referencia"?P=2:$==="Restricción de base"&&(P=1);for(const T of D){const Y=T.value||T;if(r.has(Y)){const B=l.get(Y)||0;P>B&&(a.set(Y,O),l.set(Y,P))}}}}}}}}for(const[c,d]of s.entries()){e.has(d)||e.set(d,{[n]:new Set});const u=e.get(d);u[n]||(u[n]=new Set),u[n].add(c)}for(const[c,d]of a.entries()){i.has(d)||i.set(d,{[n]:new Set});const u=i.get(d);u[n]||(u[n]=new Set),u[n].add(c)}Rt.list.clear(),Rt.list.set("Clasificación por tipo",e),Rt.list.set("Clasificación por nivel",i),S(`Clasificado en ${e.size} tipos y ${i.size} niveles.`)}function d_(){const t=document.getElementById("btn-hide"),e=document.getElementById("btn-isolate"),i=document.getElementById("btn-show-all");t&&t.addEventListener("click",async()=>{const n=Le.selection.select;n&&Object.keys(n).length>0&&(await qe.set(!1,n),Le.clear("select"))}),e&&e.addEventListener("click",async()=>{const n=Le.selection.select;n&&Object.keys(n).length>0&&(await qe.isolate(n),Le.clear("select"))}),i&&i.addEventListener("click",async()=>{await qe.set(!0),Le.clear("select")})}function u_(){console.log("[DEBUG] Setting up measurement tools...");try{_t=se.get(cf),_t.world=k,_t.enabled=!1,console.log("[DEBUG] Area Tool initialized")}catch(a){console.warn("Could not initialize Area Tool:",a)}if(!ye){const a=new fa(.15,16,16),l=new gi({color:16711935,transparent:!0,opacity:.8,depthTest:!1});ye=new Pt(a,l),ye.renderOrder=2e3,k.scene.three.add(ye),ye.visible=!1}const t=document.getElementById("btn-measure-length"),e=document.getElementById("btn-measure-point"),i=document.getElementById("btn-measure-area"),n=document.getElementById("btn-measure-angle"),o=document.getElementById("btn-measure-slope"),r=document.getElementById("btn-measure-delete");t&&t.addEventListener("click",()=>{zi("length"),ji(t)}),e&&e.addEventListener("click",()=>{zi("point"),ji(e)}),i&&i.addEventListener("click",()=>{zi("area"),ji(i),S("Area tool activated (Click points, Right-click to finish)")}),n&&n.addEventListener("click",()=>{zi("angle"),ji(n),S("Angle tool activated (Click 3 points: Start, Vertex, End)")}),o&&o.addEventListener("click",()=>{zi("slope"),ji(o),S("Slope tool activated (Click 2 points)")}),r&&r.addEventListener("click",()=>{console.log("[DEBUG] Delete button clicked");try{_t&&typeof _t.deleteAll=="function"&&_t.deleteAll()}catch(a){console.warn("Error clearing tools:",a)}Yp()});const s=document.getElementById("viewer-container");s&&(s.addEventListener("mousemove",h_),s.addEventListener("click",p_),window.addEventListener("keydown",a=>{if(a.key==="Escape"){let l=!1;if(ge&&(zi(ge),l=!0),K.enabled){K.enabled=!1;const d=document.getElementById("clipper-toggle");d&&d.classList.remove("active");const u=document.getElementById("clipper-controls");u&&(u.style.display="none"),l=!0}ye&&ye.visible&&(ye.visible=!1,l=!0);const c=Le.selection.select;c&&Object.keys(c).length>0&&(Le.clear("select"),l=!0),l&&S("Cancelled / Cleared")}}),s.addEventListener("contextmenu",a=>{if(ge==="area"&&L.length>=3){a.preventDefault();const l=L[0],c=L[L.length-1];ut(c,l);let d=0;for(let p=0;p<L.length;p++){const m=(p+1)%L.length;d+=L[p].x*L[m].z,d-=L[m].x*L[p].z}d=Math.abs(d)/2;const u=new re;L.forEach(p=>u.add(p)),u.divideScalar(L.length),u.y+=.2;const h=`${d.toFixed(2)}m²`;ht(h,u,{type:"area",points:L.map(p=>p.clone()),label:h,labelPosition:u.clone()}),S(`Area: ${h}`),L=[],V&&(k.scene.three.remove(V),V=null)}else ge&&(a.preventDefault(),_r())}))}function ji(t){["btn-measure-length","btn-measure-point","btn-measure-area","btn-measure-angle","btn-measure-slope"].forEach(e=>{const i=document.getElementById(e);i&&i.classList.remove("active")}),t&&t.classList.add("active")}function zi(t){if(_t&&_t.enabled&&(_t.enabled=!1),ge===t)ge=null,_r(),S("Measurement mode disabled"),ji(null),ye&&(ye.visible=!1);else{ge=t,_r();let e="";switch(t){case"length":e="Distance";break;case"area":e="Area";break;case"angle":e="Angle (3 Points)";break;case"slope":e="Slope (2 Points)";break;case"point":e="Point Coordinate";break}S(`Measurement mode: ${e}`)}}function _r(){L=[],V&&(k.scene.three.remove(V),V=null)}function Yp(){vr.forEach(t=>k.scene.three.remove(t)),vr.length=0,la.forEach(t=>t.remove()),la.length=0,_r(),dl=[],S("Measurements cleared")}function ke(t,e=16711680){const i=new fa(.1,16,16),n=new gi({color:e,depthTest:!1,transparent:!0,opacity:.8}),o=new Pt(i,n);return o.position.copy(t),o.renderOrder=1e3,k.scene.three.add(o),vr.push(o),o}function ut(t,e){const i=new Bi().setFromPoints([t,e]),n=new Ri({color:16776960,depthTest:!1,linewidth:2}),o=new li(i,n);return o.renderOrder=999,k.scene.three.add(o),vr.push(o),o}function ht(t,e,i){const n=document.createElement("div");n.className="measurement-label",n.textContent=t,n.style.position="absolute",n.style.background="rgba(0, 0, 0, 0.7)",n.style.color="white",n.style.padding="4px 8px",n.style.borderRadius="4px",n.style.pointerEvents="none",n.style.fontSize="12px",n.style.zIndex="1000",document.body.appendChild(n),la.push(n),i&&dl.push(i);const o=()=>{if(!n.isConnected)return;const r=e.clone().project(k.camera.three),s=(r.x*.5+.5)*window.innerWidth,a=(-(r.y*.5)+.5)*window.innerHeight;n.style.left=`${s}px`,n.style.top=`${a}px`,n.style.display=r.z>1?"none":"block",requestAnimationFrame(o)};return o(),n}async function h_(t){if(!ge){ye&&(ye.visible=!1);return}const e=await Me.castRay();if(e&&e.point){if(ye&&(ye.position.copy(e.point),ye.visible=!0),ge==="length"&&L.length===1){const i=L[0],n=e.point;if(V){const o=V.geometry.attributes.position;o.setXYZ(0,i.x,i.y,i.z),o.setXYZ(1,n.x,n.y,n.z),o.needsUpdate=!0}else{const o=new Bi().setFromPoints([i,n]),r=new Ri({color:16776960,depthTest:!1,opacity:.5,transparent:!0});V=new li(o,r),k.scene.three.add(V)}}else if(ge==="area"&&L.length>0){const i=L[L.length-1],n=e.point;if(V){const o=V.geometry.attributes.position;o.setXYZ(0,i.x,i.y,i.z),o.setXYZ(1,n.x,n.y,n.z),o.needsUpdate=!0}else{const o=new Bi().setFromPoints([i,n]),r=new Ri({color:65535,depthTest:!1,opacity:.5,transparent:!0});V=new li(o,r),k.scene.three.add(V)}}else if(ge==="angle"&&L.length>0){const i=L[L.length-1],n=e.point;if(V){const o=V.geometry.attributes.position;o.setXYZ(0,i.x,i.y,i.z),o.setXYZ(1,n.x,n.y,n.z),o.needsUpdate=!0}else{const o=new Bi().setFromPoints([i,n]),r=new Ri({color:16753920,depthTest:!1,opacity:.5,transparent:!0});V=new li(o,r),k.scene.three.add(V)}}else if(ge==="slope"&&L.length===1){const i=L[0],n=e.point;if(V){const o=V.geometry.attributes.position;o.setXYZ(0,i.x,i.y,i.z),o.setXYZ(1,n.x,n.y,n.z),o.needsUpdate=!0}else{const o=new Bi().setFromPoints([i,n]),r=new Ri({color:255,depthTest:!1,opacity:.5,transparent:!0});V=new li(o,r),k.scene.three.add(V)}}}else ye&&(ye.visible=!1)}async function p_(t){if(!ge||t.target.closest("button")||t.target.closest(".sidebar"))return;const e=await Me.castRay();if(!e||!e.point)return;const i=e.point;if(ge==="point"){ke(i,65280);const n=`X:${i.x.toFixed(2)} Y:${i.y.toFixed(2)} Z:${i.z.toFixed(2)}`;ht(n,i,{type:"point",points:[i.clone()],label:n,labelPosition:i.clone()}),S(`Point: ${n}`)}else if(ge==="length"){if(L.push(i),ke(i,16776960),L.length===2){const n=L[0],o=L[1];ut(n,o);const r=n.distanceTo(o),s=n.clone().add(o).multiplyScalar(.5),a=`${r.toFixed(3)}m`;ht(a,s,{type:"length",points:[n.clone(),o.clone()],label:a,labelPosition:s.clone()}),S(`Distance: ${a}`),L=[],V&&(k.scene.three.remove(V),V=null)}}else if(ge==="area"){if(L.push(i),ke(i,65535),L.length>1){const n=L[L.length-2];ut(n,i)}V&&(k.scene.three.remove(V),V=null)}else if(ge==="angle"){if(L.push(i),ke(i,16753920),L.length>1){const n=L[L.length-2];ut(n,i)}if(L.length===3){const n=L[0],o=L[1],r=L[2],s=n.clone().sub(o).normalize(),a=r.clone().sub(o).normalize(),l=s.angleTo(a),d=`${bl.radToDeg(l).toFixed(1)}°`;ht(d,o,{type:"angle",points:[n.clone(),o.clone(),r.clone()],label:d,labelPosition:o.clone()}),S(`Angle: ${d}`),L=[],V&&(k.scene.three.remove(V),V=null)}}else if(ge==="slope"&&(L.push(i),ke(i,255),L.length===2)){const n=L[0],o=L[1];ut(n,o),Math.abs(o.y-n.y);const r=Math.sqrt(Math.pow(o.x-n.x,2)+Math.pow(o.z-n.z,2));let s=0;r!==0?s=Math.atan(Math.abs(o.y-n.y)/r):s=Math.PI/2;const a=bl.radToDeg(s),l=n.clone().add(o).multiplyScalar(.5),c=`${a.toFixed(1)}°`;ht(c,l,{type:"slope",points:[n.clone(),o.clone()],label:c,labelPosition:l.clone()}),S(`Slope: ${c}`),L=[],V&&(k.scene.three.remove(V),V=null)}}function f_(){console.log("[DEBUG] Setting up Viewpoints Manager...");const t={getMeasurements:()=>dl,restoreMeasurements:n=>{Yp(),!(!n||!Array.isArray(n))&&n.forEach(o=>{if(o.type==="point"&&o.points&&o.points.length>0){const r=new re(o.points[0].x,o.points[0].y,o.points[0].z);ke(r,65280),ht(o.label,r,o)}else if(o.type==="length"&&o.points&&o.points.length===2){const r=new re(o.points[0].x,o.points[0].y,o.points[0].z),s=new re(o.points[1].x,o.points[1].y,o.points[1].z);ke(r,16776960),ke(s,16776960),ut(r,s);const a=new re(o.labelPosition.x,o.labelPosition.y,o.labelPosition.z);ht(o.label,a,o)}else if(o.type==="angle"&&o.points&&o.points.length===3){const r=new re(o.points[0].x,o.points[0].y,o.points[0].z),s=new re(o.points[1].x,o.points[1].y,o.points[1].z),a=new re(o.points[2].x,o.points[2].y,o.points[2].z);ke(r,16753920),ke(s,16753920),ke(a,16753920),ut(r,s),ut(s,a),ht(o.label,s,o)}else if(o.type==="slope"&&o.points&&o.points.length===2){const r=new re(o.points[0].x,o.points[0].y,o.points[0].z),s=new re(o.points[1].x,o.points[1].y,o.points[1].z);ke(r,255),ke(s,255),ut(r,s);const a=new re(o.labelPosition.x,o.labelPosition.y,o.labelPosition.z);ht(o.label,a,o)}else if(o.type==="area"&&o.points&&o.points.length>2){const r=o.points.map(a=>new re(a.x,a.y,a.z));r.forEach(a=>ke(a,65535));for(let a=0;a<r.length;a++)ut(r[a],r[(a+1)%r.length]);const s=new re(o.labelPosition.x,o.labelPosition.y,o.labelPosition.z);ht(o.label,s,o)}})},getHiddenItems:()=>{const n={};for(const o in Be)Be[o].size>0&&(n[o]=Array.from(Be[o]));return n},restoreHiddenItems:async n=>{await qe.set(!0),Object.keys(n).length>0&&await qe.set(!1,n)},getClippingPlanes:()=>{console.log("[Viewpoints] Getting clipping planes...");const n=[];try{const o=k?.renderer?.three?.clippingPlanes;if(Array.isArray(o)&&o.length>0){console.log(`[Viewpoints] Found ${o.length} clipping planes in renderer.`);for(const r of o)r?.normal&&n.push({normal:r.normal.toArray(),constant:r.constant});return n}if(!K||!K.list)return console.warn("[Viewpoints] Clipper not initialized or list unavailable"),[];if(console.log(`[Viewpoints] Clipper list size: ${K.list.size||K.list.length}`),K.list.size>0&&K.list.forEach((r,s)=>{console.log(`[Viewpoints] Map.forEach - Plane ${s}:`,r);let a=null;const l=r;l.plane?a=l.plane:l.normal&&l.constant!==void 0?a=l:l.object&&l.object.plane&&(a=l.object.plane),a&&n.push({normal:a.normal.toArray(),constant:a.constant})}),n.length===0&&K.planes&&Array.isArray(K.planes)){const r=K.planes;for(const s of r)s?.normal&&s?.constant!==void 0&&n.push({normal:s.normal.toArray(),constant:s.constant})}return console.log(`[Viewpoints] Serialized clipping planes count: ${n.length}`),n}catch(o){return console.error("[Viewpoints] Error getting clipping planes:",o),[]}},restoreClippingPlanes:n=>{console.log("[Viewpoints] Restoring clipping planes (count):",n?n.length:0),console.log("[Viewpoints] Raw planes data:",JSON.stringify(n));try{if(K.list.size>0&&(console.log(`[Viewpoints] Clearing ${K.list.size} existing planes...`),K.deleteAll()),k?.renderer?.three&&Array.isArray(k.renderer.three.clippingPlanes)&&(k.renderer.three.clippingPlanes=[],k.renderer.three.localClippingEnabled=!0),!n||n.length===0){console.log("[Viewpoints] No planes to restore. Disabling clipper."),K.enabled=!1;const s=document.getElementById("clipper-toggle");s&&s.classList.remove("active");const a=document.getElementById("clipper-controls");a&&(a.style.display="none");return}console.log("[Viewpoints] Enabling clipper tool..."),K.enabled=!0;const o=document.getElementById("clipper-toggle");o&&o.classList.add("active");const r=document.getElementById("clipper-controls");r&&(r.style.display="flex"),n.forEach((s,a)=>{if(console.log(`[Viewpoints] Restoring plane #${a}:`,s),s.normal&&s.constant!==void 0){const l=new re(s.normal[0],s.normal[1],s.normal[2]).normalize(),c=s.constant,d=l.clone().multiplyScalar(-c);console.log(`[Viewpoints] Creating plane #${a}: normal=${l.toArray()}, constant=${c}`);const u=K.createFromNormalAndCoplanarPoint(k,l,d);console.log(`[Viewpoints] Plane #${a} created:`,u)}else console.warn("[Viewpoints] Invalid plane data for plane #${index}:",s)})}catch(o){console.error("[Viewpoints] Error restoring clipping planes:",o)}},getLoadedModels:()=>{const n=[],o=F.list&&F.list.size>0?F.list:F.groups,r=o instanceof Map?Array.from(o.entries()):Object.entries(o||{});console.log(`[Viewpoints] Saving models. Found ${r.length} groups/models.`),S(`[Viewpoints] Found ${r.length} models.`);for(const[s,a]of r){const l=a.object&&a.object.visible!==void 0?a.object.visible:a.visible!==void 0?a.visible:!0;if(!l){console.log(`[Viewpoints] Model ${s} is hidden (visible=${l}). Skipping.`),S(`[Viewpoints] Skipping hidden: ${s}`);continue}if(S(`[Viewpoints] Processing visible: ${s}`),a.userData)if(console.log(`[Viewpoints] Inspecting model ${s}:`,a.userData),a.userData.isLocal&&a.userData.dbKey){const c=`indexeddb://${a.userData.dbKey}`;n.push({uuid:s,url:c}),console.log(`[Viewpoints] Saved local model reference: ${c}`),S(`[Viewpoints] Saved local: ${a.userData.dbKey}`)}else a.userData.url?(n.push({uuid:s,url:a.userData.url}),console.log(`[Viewpoints] Saved remote model reference: ${a.userData.url}`),S(`[Viewpoints] Saved remote: ${a.userData.url}`)):(console.warn(`[Viewpoints] Model ${s} has no URL or DB key. Skipping persistence.`),S(`[Viewpoints] SKIP: No URL/DBKey for ${s}`,!0));else console.warn(`[Viewpoints] Model ${s} has no userData. Skipping persistence.`),S(`[Viewpoints] SKIP: No userData for ${s}`,!0)}return n},restoreLoadedModels:async n=>{const o=F.list&&F.list.size>0?F.list:F.groups,r=o instanceof Map,s=new Set(r?o.keys():Object.keys(o||{})),a=new Set(n.map(l=>l.uuid));for(const l of s){const c=r?o.get(l):o[l];if(c){const d=a.has(l);c.object&&(c.object.visible=d),c.visible!==void 0&&(c.visible=d),console.log(`[Viewpoints] Sync visibility for ${l}: ${d}`)}}for(const l of n)if(s.has(l.uuid))console.log(`[Viewpoints] Model ${l.uuid} already loaded. Skipping.`);else try{console.log(`[Viewpoints] Restoring model: ${l.uuid} from ${l.url}`);let c=l.url,d=!1,u="";if(l.url.startsWith("indexeddb://")){u=l.url.replace("indexeddb://",""),S(`Restoring local model from storage: ${u}...`);const h=await J$(u);if(h){console.log(`[Viewpoints] Retrieved ${h.byteLength} bytes from IDB for ${u}`);const p=new Blob([h]);c=URL.createObjectURL(p),d=!0}else{console.warn(`Local model ${u} not found in IndexedDB.`),S(`Error: Local model ${u} expired/missing. Please reload file.`,!0);continue}}if(console.log(`[Viewpoints] Calling loadModel with URL: ${c}`),await pl(c,l.uuid),console.log(`[Viewpoints] loadModel completed for ${l.uuid}`),d){const h=r?F.groups.get(l.uuid):F.groups[l.uuid];h?(h.userData||(h.userData={}),h.userData.isLocal=!0,h.userData.dbKey=u,h.userData.url=c,console.log(`[Viewpoints] Restored local metadata for ${l.uuid}`)):console.error(`[Viewpoints] Model ${l.uuid} not found in fragments.groups after load!`)}}catch(c){console.error(`[Viewpoints] Failed to restore model ${l.uuid}:`,c)}}};$s=new uf(se,k,t);const e=document.getElementById("viewpoints-list-container");e&&$s.createUI(e);const i=document.getElementById("btn-add-viewpoint");if(i){const n=i.cloneNode(!0);i.parentNode?.replaceChild(n,i),n.addEventListener("click",()=>{$s?.openSaveModal()})}}const Xp="https://alcabama-commits.github.io/bim/inse.html";function Zp(){const t=sessionStorage.getItem("userAccount")||localStorage.getItem("userAccount");if(!t)return null;try{const e=JSON.parse(t);return!e||typeof e!="object"?null:e}catch(e){return console.error("[Auth] Error parsing user account:",e),null}}function m_(){const t=document.getElementById("app");if(!t)return;const e=Zp(),i=document.getElementById("auth-gate-overlay");if(e){i?.remove(),t.style.pointerEvents="",t.style.userSelect="",t.style.filter="",document.body.style.overflow="";return}if(i)return;t.style.pointerEvents="none",t.style.userSelect="none",t.style.filter="blur(4px)",document.body.style.overflow="hidden";const n=document.createElement("div");n.id="auth-gate-overlay",n.style.position="fixed",n.style.inset="0",n.style.zIndex="10000",n.style.display="flex",n.style.alignItems="center",n.style.justifyContent="center",n.style.padding="24px",n.style.background="radial-gradient(circle at top, rgba(211, 4, 92, 0.22), rgba(211, 4, 92, 0) 30%), linear-gradient(135deg, rgba(255,255,255,0.96), rgba(245,245,245,0.96))",n.innerHTML=`
        <div style="width:min(520px, 100%); background:#ffffff; border:1px solid rgba(211, 4, 92, 0.14); border-radius:24px; padding:36px 32px; box-shadow:0 30px 80px rgba(96, 94, 98, 0.18); text-align:center; font-family:Inter, Arial, sans-serif;">
            <img src="https://i.postimg.cc/GmWLmfZZ/Logo-transparente-negro.png" alt="Alcabama" style="height:44px; width:auto; margin:0 auto 22px; display:block;" />
            <div style="width:72px; height:72px; margin:0 auto 18px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(211, 4, 92, 0.08); color:#d3045c; font-size:28px;">
                <i class="fa-solid fa-lock"></i>
            </div>
            <h1 style="margin:0 0 10px; font-size:28px; line-height:1.15; color:#1f1f1f;">Inicia sesión para continuar</h1>
            <p style="margin:0 0 22px; font-size:15px; line-height:1.6; color:#605e62;">
                Debes autenticarte para acceder al visor VSR IFC. Si abriste este enlace directamente, primero inicia sesión y luego vuelve a entrar.
            </p>
            <a href="${Xp}" style="display:inline-flex; align-items:center; justify-content:center; gap:10px; min-width:220px; padding:14px 18px; border-radius:12px; background:#d3045c; color:#fff; text-decoration:none; font-weight:700; font-size:15px; box-shadow:0 12px 28px rgba(211, 4, 92, 0.28);">
                <i class="fa-solid fa-right-to-bracket"></i>
                <span>Ir a iniciar sesión</span>
            </a>
            <p style="margin:16px 0 0; font-size:12px; color:#a49fa6;">
                Cuando tu sesión esté activa, recarga esta página para ingresar.
            </p>
        </div>
    `,document.body.appendChild(n)}f_();function b_(){console.log("[Auth] Setting up user authentication...");const t=document.getElementById("user-profile-container");if(!t){console.warn("[Auth] user-profile-container not found");return}const e=Zp();if(e)try{console.log("[Auth] User found:",e.name);const i=document.createElement("span"),n=e.name?e.name.split(" ")[0]:"Usuario";i.textContent=`Hola, ${n}`,i.style.fontSize="14px",i.style.fontWeight="500",i.style.color="var(--text-dark-gray)";const o=document.createElement("div");o.style.width="32px",o.style.height="32px",o.style.borderRadius="50%",o.style.backgroundColor="var(--primary-color)",o.style.color="white",o.style.display="flex",o.style.alignItems="center",o.style.justifyContent="center",o.style.fontSize="14px",o.style.fontWeight="bold";let r="U";if(e.name){const a=e.name.split(" ");a.length>=2?r=(a[0][0]+a[1][0]).toUpperCase():r=a[0][0].toUpperCase()}o.textContent=r,o.title=e.name+(e.role?` (${e.role})`:"");const s=document.createElement("button");s.innerHTML='<i class="fa-solid fa-right-from-bracket"></i>',s.title="Cerrar Sesión",s.style.background="none",s.style.border="none",s.style.cursor="pointer",s.style.fontSize="16px",s.style.color="#666",s.style.marginLeft="5px",s.onmouseover=()=>{s.style.color="#e91e63"},s.onmouseout=()=>{s.style.color="#666"},s.onclick=()=>{confirm("¿Cerrar sesión?")&&(sessionStorage.removeItem("userAccount"),localStorage.removeItem("userAccount"),window.location.reload())},t.appendChild(i),t.appendChild(o),t.appendChild(s)}catch(i){console.error("[Auth] Error rendering user account:",i),hd(t)}else console.log("[Auth] No user found. Rendering guest mode."),hd(t)}function hd(t){const e=document.createElement("a");e.href=Xp,e.innerHTML='<i class="fa-solid fa-user"></i> <span style="margin-left:5px; font-size:14px;">Iniciar Sesión</span>',e.style.textDecoration="none",e.style.color="var(--primary-color)",e.style.display="flex",e.style.alignItems="center",e.style.fontWeight="500",e.removeAttribute("target"),t.appendChild(e)}m_();b_();window.location.search.includes("test=auth")&&(console.log("Running Auth Tests..."),ff(async()=>{const{runViewpointAuthTests:t}=await import("./auth-viewpoints.test-DXbwuKEz.js");return{runViewpointAuthTests:t}},__vite__mapDeps([0,1]),import.meta.url).then(({runViewpointAuthTests:t})=>(window.runAuthTests=t,t())).then(()=>{console.log("Auth Tests Completed.")}).catch(t=>{console.error("Auth Tests Failed:",t)}));
