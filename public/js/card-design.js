// One coordinate system and one drawing list for DOM cards and WebGL textures.
export const CARD_WIDTH = 256, CARD_HEIGHT = 360;
const FONT = '"Rook Display","Trebuchet MS",sans-serif';
export function createCardDesign({ birdPath, wingPath, eye, suits, points }) {
  function commands(card) {
    const out = [];
    const rect = (x,y,w,h,r,fill,stroke='none',line=0) => out.push({kind:'rect',x,y,w,h,r,fill,stroke,line});
    const circle = (x,y,r,fill) => out.push({kind:'circle',x,y,r,fill});
    const text = (value,x,y,size,fill,rotate=0) => out.push({kind:'text',value:String(value),x,y,size,fill,rotate});
    const bird = (x,y,size,fill,eyeFill,wingFill) => out.push({kind:'bird',x,y,size,fill,eyeFill,wingFill});
    rect(2,2,252,356,22,card?.id==='ROOK'?'#1740ab':'#fbfcff','#b6c4dc',4);
    if (!card) {
      rect(13,13,230,334,15,'#1740ab');
      circle(128,180,80,'#fff');
      bird(67,117,122,'#123a9c','#fff','#6d89c8');
    } else if (card.id==='ROOK') {
      rect(15,15,226,330,14,'none','#fff',5);
      text('ROOK',128,49,43,'#fff');
      bird(30,91,196,'#fff','#123a9c','#a9c3ef');
      text('20',128,319,38,'#fff');
    } else {
      const hue=card.color==='Y'?'#b58b00':suits[card.color].hex;
      rect(36,63,184,234,17,'none',hue,6);
      text(card.rank,128,172,card.rank>=10?100:116,hue);
      bird(105,232,46,hue,'#fff','none');
      text(card.rank,card.rank>=10?41:30,29,43,hue);
      text(card.rank,256-(card.rank>=10?41:30),331,43,hue,180);
      const p=points(card);
      if(p){circle(219,29,23,'#12365c');text(p,219,29,31,'#fff');}
    }
    return out;
  }
  const attr = value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;');
  function svg(card) {
    const body=commands(card).map(c=>{
      if(c.kind==='rect')return `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="${c.r}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="${c.line}"/>`;
      if(c.kind==='circle')return `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="${c.fill}"/>`;
      if(c.kind==='text')return `<text x="${c.x}" y="${c.y}" text-anchor="middle" dominant-baseline="central" font-family="${attr(FONT)}" font-size="${c.size}" fill="${c.fill}" transform="rotate(${c.rotate} ${c.x} ${c.y})">${c.value}</text>`;
      return `<g transform="translate(${c.x} ${c.y}) scale(${c.size/100})"><path d="${birdPath}" fill="${c.fill}"/><path d="${wingPath}" fill="${c.wingFill}"/><circle cx="${eye.cx}" cy="${eye.cy}" r="${eye.r}" fill="${c.eyeFill}"/></g>`;
    }).join('');
    return `<svg class="card-art" viewBox="0 0 256 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`;
  }
  function draw(ctx,card) {
    ctx.clearRect(0,0,CARD_WIDTH,CARD_HEIGHT);
    for(const c of commands(card)){
      ctx.save();
      if(c.kind==='rect'){
        ctx.beginPath();ctx.roundRect(c.x,c.y,c.w,c.h,c.r);
        if(c.fill!=='none'){ctx.fillStyle=c.fill;ctx.fill();}
        if(c.line){ctx.strokeStyle=c.stroke;ctx.lineWidth=c.line;ctx.stroke();}
      } else if(c.kind==='circle'){
        ctx.beginPath();ctx.arc(c.x,c.y,c.r,0,Math.PI*2);ctx.fillStyle=c.fill;ctx.fill();
      } else if(c.kind==='text'){
        ctx.translate(c.x,c.y);ctx.rotate(c.rotate*Math.PI/180);
        ctx.font=`${c.size}px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillStyle=c.fill;
        const m=ctx.measureText(c.value);
        ctx.fillText(c.value,0,(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2);
      } else {
        ctx.translate(c.x,c.y);ctx.scale(c.size/100,c.size/100);
        ctx.fillStyle=c.fill;ctx.fill(new Path2D(birdPath));
        if(c.wingFill!=='none'){ctx.fillStyle=c.wingFill;ctx.fill(new Path2D(wingPath));}
        ctx.beginPath();ctx.arc(eye.cx,eye.cy,eye.r,0,Math.PI*2);ctx.fillStyle=c.eyeFill;ctx.fill();
      }
      ctx.restore();
    }
  }
  return {svg,draw,commands};
}
