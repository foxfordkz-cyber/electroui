(function installCityScene(){
  'use strict';
  let script;
  function loadLibrary() {
    if (!script) script = new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = 'static/vendor/maplibre/maplibre-gl.js';
      tag.onload = () => resolve(window.maplibregl);
      tag.onerror = () => { tag.remove(); script = null; reject(new Error('3D карта жүктелмеді.')); };
      document.head.append(tag);
    });
    return script;
  }
  function footprints(items, selected) {
    const groups = new Map();
    for (const item of items) {
      if (!item.point) continue;
      const key = item.point.join(',');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    const features = [];
    for (const [key, homes] of groups) {
      const [lat, lon] = homes[0].point;
      // Symbols occupy part of the rounded cell; their height encodes load, not building dimensions.
      const dy = .00125, dx = Math.min(.004, dy / Math.cos(lat * Math.PI / 180));
      const ring = [[lon-dx,lat-dy],[lon+dx,lat-dy],[lon+dx,lat+dy],[lon-dx,lat+dy],[lon-dx,lat-dy]];
      const power = homes.reduce((sum, item) => sum + item.power, 0);
      features.push({type:'Feature', properties:{key, height:60 + Math.min(630, 9 * Math.sqrt(power)),
        color:homes.some((item) => item.id === selected) ? '#e5a34c' : '#087e80'},
        geometry:{type:'Polygon',coordinates:[ring]}});
    }
    return {type:'FeatureCollection',features};
  }
  function create(gl, container, center, zoom, onSelect) {
    let items = [], selected = null;
    const source = 'apartment-cells', layer = 'apartment-columns';
    const map = new gl.Map({container, center:[center.lng,center.lat], zoom:zoom-1, pitch:53, bearing:-18,
      maxPitch:70, maxZoom:18, attributionControl:false, canvasContextAttributes:{antialias:true},
      style:{version:8, sources:{streets:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,
        attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}},
        layers:[{id:'streets',type:'raster',source:'streets',paint:{'raster-saturation':-.28}}]}});
    map.addControl(new gl.NavigationControl({visualizePitch:true}),'top-left');
    map.addControl(new gl.AttributionControl({compact:false}),'bottom-right');
    map.scrollZoom.disable();
    map.on('style.load', () => {
      map.addSource(source,{type:'geojson',data:footprints(items,selected)});
      map.addLayer({id:layer,type:'fill-extrusion',source,paint:{'fill-extrusion-color':['get','color'],
        'fill-extrusion-height':['get','height'],'fill-extrusion-opacity':.95}});
    });
    map.on('click',layer,(e) => {
      const key=e.features?.[0]?.properties.key;
      const homes=items.filter((item) => item.point?.join(',') === key);
      if (homes.length === 1) onSelect(homes[0]);
      else if (homes.length) {
        const content=document.createElement('div'); content.className='atlas-popup';
        const popup=new gl.Popup().setLngLat(e.lngLat).setDOMContent(content).addTo(map);
        for (const item of homes) {
          const b=document.createElement('button'); b.textContent=item.label+' · 3D';
          b.onclick=()=>{popup.remove();onSelect(item);}; content.append(b);
        }
      }
    });
    map.on('mouseenter',layer,()=>{map.getCanvas().style.cursor='pointer';});
    map.on('mouseleave',layer,()=>{map.getCanvas().style.cursor='';});
    return {
      update(next, id) { items=next; selected=id; map.getSource(source)?.setData(footprints(items,selected)); },
      reset(center, zoom) { map.resize(); map.jumpTo({center:[center.lng,center.lat],zoom:zoom-1}); },
      showAll(points) {
        if (!points.length) return;
        const bounds=new gl.LngLatBounds();
        points.forEach(([lat,lon])=>bounds.extend([lon,lat]));
        map.fitBounds(bounds,{padding:52,maxZoom:14,pitch:53,bearing:-18,duration:0});
      },
      destroy() { map.remove(); },
    };
  }
  window.EnergyCityScene = {loadLibrary, create};
})();
