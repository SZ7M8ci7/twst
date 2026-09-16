import type { Box, Detection } from './types';

export type Pixels = { width: number; height: number; data: Uint8ClampedArray | Uint8Array };

/** Segment isolated numeric glyphs when line OCR drops repeated thin 1s. */
export function levelGlyphs(image: Pixels): { image: Pixels; symbol?: '1' | '/' }[] | undefined {
  const { width, height, data } = image, columns: number[] = [];
  for (let x = 0; x < width; x++) {
    let ink = 0;
    for (let y = 0; y < height; y++) if (data[(y * width + x) * 4] < 150) ink++;
    if (ink) columns.push(x);
  }
  const groups: number[][] = [];
  for (const x of columns) {
    if (!groups.length || x > groups[groups.length - 1].at(-1)! + 1) groups.push([]);
    groups[groups.length - 1].push(x);
  }
  if (groups.length < 3 || groups.length > 7) return undefined;
  const glyphs = groups.map(xs => {
    const left = xs[0], right = xs[xs.length - 1], points: { x: number; y: number }[] = [];
    for (let y = 0; y < height; y++) for (let x = left; x <= right; x++) if (data[(y * width + x) * 4] < 150) points.push({ x, y });
    const top = Math.min(...points.map(p => p.y)), bottom = Math.max(...points.map(p => p.y)), w = right - left + 1, h = bottom - top + 1;
    const topXs = points.filter(p => p.y < top + h * .25).map(p => p.x), bottomXs = points.filter(p => p.y > bottom - h * .25).map(p => p.x);
    const mean = (values: number[]) => values.reduce((a,b)=>a+b,0)/values.length;
    const slash = w / h > .28 && w / h < .75 && mean(topXs) - mean(bottomXs) > h * .25 && points.length / (w*h) < .6;
    const pad = 18, pixels = new Uint8ClampedArray((w + pad*2) * (h + pad*2) * 4).fill(255);
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const from = (y*width+x)*4, to=((y-top+pad)*(w+pad*2)+x-left+pad)*4;
      pixels.set(data.subarray(from,from+4),to);
    }
    return { image:{width:w+pad*2,height:h+pad*2,data:pixels}, symbol:slash ? '/' as const : w/h<.28 ? '1' as const : undefined };
  });
  const slash = glyphs.findIndex(g=>g.symbol==='/');
  return slash>=1 && slash<=3 && glyphs.length-slash-1>=1 && glyphs.length-slash-1<=3 && glyphs.filter(g=>g.symbol==='/').length===1 ? glyphs : undefined;
}

/** Keep the tall numeric glyphs, removing the frame, artwork and small Lv label. */
export function prepareLevelImage(image: Pixels): Pixels | undefined {
  const { width, height, data } = image;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const r=data[i*4], g=data[i*4+1], b=data[i*4+2];
    mask[i] = Math.min(r,g,b) > 175 && Math.max(r,g,b)-Math.min(r,g,b) < 65 ? 1 : 0;
  }
  const components: { pixels: number[]; x: number; y: number; w: number; h: number }[] = [];
  for (let i=0;i<mask.length;i++) {
    if (!mask[i]) continue;
    const pixels=[i]; mask[i]=0; let minX=width,minY=height,maxX=0,maxY=0;
    for(let j=0;j<pixels.length;j++) {
      const p=pixels[j],x=p%width,y=Math.floor(p/width);
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
        const nx=x+dx,ny=y+dy,n=ny*width+nx;
        if(nx>=0&&nx<width&&ny>=0&&ny<height&&mask[n]) {mask[n]=0;pixels.push(n);}
      }
    }
    const w=maxX-minX+1,h=maxY-minY+1;
    if(w<width*.25 && maxY>height*.4) components.push({pixels,x:minX,y:minY,w,h});
  }
  const tallest=Math.max(0,...components.map(c=>c.h));
  const ordered=components.sort((a,b)=>a.x-b.x);
  // Lv is a shorter L followed by an even shorter v. Remove that pair,
  // then retain narrow 1s and slashes even when compression shortens them.
  let start=0;
  while(ordered[start] && ordered[start].h<tallest*.9 && ordered[start].w>ordered[start].h*.9) start++;
  for(let i=1;i<ordered.length;i++) {
    if(ordered[i].x<width*.6 && ordered[i-1].h<tallest*.90 && ordered[i].h<tallest*.68 && ordered[i].x-ordered[i-1].x<width*.12) start=i+1;
  }
  const digits=ordered.slice(start).filter(c=>c.h>=tallest*.65);
  if(digits.length<3 || digits.length>7 || tallest<5) return undefined;
  const x=digits[0].x,y=Math.min(...digits.map(c=>c.y)),right=Math.max(...digits.map(c=>c.x+c.w)),bottom=Math.max(...digits.map(c=>c.y+c.h));
  const pad=12, scale=3, outWidth=(right-x)*scale+pad*2,outHeight=(bottom-y)*scale+pad*2;
  const result=new Uint8ClampedArray(outWidth*outHeight*4).fill(255);
  const values=Array.from({length:width*height},(_,i)=>Math.min(data[i*4],data[i*4+1],data[i*4+2])).sort((a,b)=>a-b);
  const background=values[Math.floor(values.length*.5)];
  for(let py=y;py<bottom;py++) for(let px=x;px<right;px++) {
    const p=(py*width+px)*4;
    const ink=Math.max(0,Math.min(255,(Math.min(data[p],data[p+1],data[p+2])-background)*255/Math.max(40,245-background)));
    for(let dy=0;dy<scale;dy++) for(let dx=0;dx<scale;dx++) {
      const n=((py-y)*scale+pad+dy)*outWidth+((px-x)*scale+pad+dx);
      result[n*4]=result[n*4+1]=result[n*4+2]=255-ink;
    }
  }
  return {width:outWidth,height:outHeight,data:result};
}

export function levelRegion(box: Box, imageHeight: number): Box {
  const y=Math.round(box.y+box.width*1.04);
  return {x:Math.round(box.x+box.width*.08),y,width:Math.round(box.width*.88),height:Math.max(0,Math.min(Math.round(box.width*.23),imageHeight-y))};
}

/** Four equally spaced circles distinguish the uncap footer from the Lv footer. */
export function readUncapDots(image: Pixels): number | undefined {
  const { width:w, height:h, data } = image;
  const mask = new Uint8Array(w*h);
  for (let y=Math.round(w*1.025); y<Math.min(h,Math.round(w*1.245)); y++) {
    for (let x=Math.round(w*.31); x<Math.round(w*.98); x++) {
      const i=(y*w+x)*4, r=data[i], g=data[i+1], b=data[i+2];
      const purple=r>65 && b>70 && Math.min(r,b)-g>25;
      const gray=Math.min(r,g,b)>65 && Math.max(r,g,b)<150 && Math.max(r,g,b)-Math.min(r,g,b)<35;
      if (purple || gray) mask[y*w+x]=purple?2:1;
    }
  }
  const dots: {x:number;y:number;filled:boolean}[]=[];
  for (let i=0;i<mask.length;i++) {
    if (!mask[i]) continue;
    const queue=[i];let purple=0,minX=w,maxX=0,minY=h,maxY=0;
    for (let j=0;j<queue.length;j++) {
      const p=queue[j], kind=mask[p];if (!kind) continue;
      mask[p]=0;if(kind===2)purple++;
      const x=p%w,y=Math.floor(p/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx=x+dx,ny=y+dy;if(nx>=0&&nx<w&&ny>=0&&ny<h&&mask[ny*w+nx])queue.push(ny*w+nx);
      }
    }
    const dw=maxX-minX+1,dh=maxY-minY+1;
    // Queue entries may repeat; use the bounding box and colored center below.
    if(dw<w*.045||dw>w*.145||dh<w*.045||dh>w*.145||dw/dh<.55||dw/dh>1.85)continue;
    let area=0;
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++) {
      const p=(y*w+x)*4,r=data[p],g=data[p+1],b=data[p+2];
      if((r>65&&b>70&&Math.min(r,b)-g>25)||(Math.min(r,g,b)>65&&Math.max(r,g,b)<150&&Math.max(r,g,b)-Math.min(r,g,b)<35))area++;
    }
    if(area/(dw*dh)<.45)continue;
    dots.push({x:(minX+maxX)/2/w,y:(minY+maxY)/2/w,filled:purple/area>.45});
  }
  dots.sort((a,b)=>a.x-b.x);
  if(dots.length!==4||Math.abs(dots[0].x-.405)>.055||Math.abs(dots[3].x-.88)>.055)return;
  if(dots.some((dot,i)=>Math.abs(dot.y-dots[0].y)>.025||(i>0&&Math.abs(dot.x-dots[i-1].x-.16)>.035)))return;
  const firstEmpty=dots.findIndex(dot=>!dot.filled), count=firstEmpty<0?4:firstEmpty;
  if(dots.slice(count).some(dot=>dot.filled))return;
  return count;
}

/** Read visual evidence first; SSR level-cap evidence is applied after identifying the card. */
export function readUncaps(image: Pixels): { totsu?: number; totsuEvidence: 'dots' | 'black-frame' | 'magic3' | 'unknown' } {
  const dots=readUncapDots(image);
  if(dots!==undefined)return {totsu:dots,totsuEvidence:'dots'};
  const {width:w,height:h,data}=image;
  const fraction=(x0:number,y0:number,x1:number,y1:number,predicate:(r:number,g:number,b:number)=>boolean)=>{
    let count=0,total=0;
    for(let y=Math.max(0,Math.round(y0*w));y<Math.min(h,Math.round(y1*w));y++) for(let x=Math.round(x0*w);x<Math.round(x1*w);x++) {
      const i=(y*w+x)*4; total++; if(predicate(data[i],data[i+1],data[i+2])) count++;
    }
    return total?count/total:0;
  };
  const dark=(r:number,g:number,b:number)=>Math.max(r,g,b)<85;
  const left=Math.max(...[.008,.025,.04,.055,.07].map(x=>fraction(x,.22,x+.012,.9,dark))), footer=fraction(.08,1.065,.30,1.20,dark);
  if(left>.55 && footer>.60) return {totsu:4,totsuEvidence:'black-frame'};
  // Flags are ~18% of a card wide and fixed at the top right. The third
  // flag starts around 42%, with a white element symbol on its tinted body.
  const samples=[.43,.56].flatMap(x=>[.035,.07,.13].map(y=>{
    const i=(Math.round(y*w)*w+Math.round(x*w))*4;return [data[i],data[i+1],data[i+2]];
  }));
  const mean=[0,1,2].map(c=>samples.reduce((sum,p)=>sum+p[c],0)/samples.length);
  const flat=samples.every(p=>Math.hypot(...p.map((v,c)=>v-mean[c]))<40);
  const tinted=mean[2]-mean[0]>10 || mean[1]-mean[0]>35 || mean[0]-mean[1]>80;
  const symbol=fraction(.46,.025,.55,.11,(r,g,b)=>Math.min(r,g,b)>Math.max(160,Math.min(...mean)+20) && Math.max(r,g,b)-Math.min(r,g,b)<45);
  return flat && tinted && symbol>.025 ? {totsu:3,totsuEvidence:'magic3'} : {totsuEvidence:'unknown'};
}

/** Re-evaluate when the selected card changes, without overwriting manual or visual evidence. */
export function applyMaxLevelUncaps(row: Detection, rarity?: string): void {
  if (row.totsuEvidence !== 'unknown' && row.totsuEvidence !== 'max-level') return;
  row.totsu = undefined;
  row.totsuEvidence = 'unknown';
  if (rarity !== 'SSR' || !Number.isInteger(row.maxLevel)) return;
  if (row.maxLevel! >= 80 && row.maxLevel! <= 84) row.totsu = 0;
  else if (row.maxLevel! >= 106 && row.maxLevel! <= 110) row.totsu = 2;
  if (row.totsu !== undefined) row.totsuEvidence = 'max-level';
}
