'use client';
import {Children,useEffect,useState,type ReactNode} from 'react';
import {ResizablePanelGroup,ResizablePanel,ResizableHandle} from '@/components/ui/resizable';
export function AllocationSplit({children}:{children:ReactNode}){
 const [wide,setWide]=useState(false);
 const [layout,setLayout]=useState<Record<string,number>>({schemes:70,cart:30});
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('allocation-panel-widths')||'null');if(saved&&Number.isFinite(saved.schemes)&&Number.isFinite(saved.cart)&&saved.schemes>=52&&saved.cart>=20&&Math.abs(saved.schemes+saved.cart-100)<1)setLayout(saved)}catch{}const media=matchMedia('(min-width: 1000px)');const update=()=>setWide(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 const parts=Children.toArray(children);
 if(!wide)return <div className="console">{children}</div>;
 return <ResizablePanelGroup className="allocation-split" orientation="horizontal" defaultLayout={layout} onLayoutChanged={value=>{try{localStorage.setItem('allocation-panel-widths',JSON.stringify(value))}catch{}}}><ResizablePanel id="schemes" defaultSize="70%" minSize="52%" className="allocation-pane">{parts[0]}</ResizablePanel><ResizableHandle className="allocation-divider" aria-label="Resize scheme list and allocation cart" title="Drag to resize • Arrow keys to adjust"><span className="divider-grip" aria-hidden="true">⋮</span></ResizableHandle><ResizablePanel id="cart" defaultSize="30%" minSize="280px" maxSize="45%" className="allocation-pane">{parts[1]}</ResizablePanel></ResizablePanelGroup>
}
