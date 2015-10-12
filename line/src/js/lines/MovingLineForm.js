class MovingLineForm extends Form {

  constructor(...args) {
    super(...args);
  }

  _getSegmentDistance( last, curr, index ) {
    return (last && curr) ? curr.distance( last ) : 0;
  }


  _getSegmentNormal( last, curr, dist, t=0.5, distRatio ) {
    if (last) {
      let ln = new Line( last ).to( curr );
      let dr1 = (distRatio != null) ? distRatio : 1;
      let dr2 = (distRatio != null) ? 1-distRatio : 1;
      return {p1: ln.getPerpendicular( t, dist * dr1 ).p1, p2: ln.getPerpendicular( t, dist * dr2, true ).p1 };
    } else {
      return {p1: curr.clone(), p2: curr.clone()};
    }
  }

  /**
   * Draw noise polygons
   * @param noise noise instance (seeded)
   * @param noiseIncrement noise value addition
   * @param dist thickness of brush
   * @param layerRatio a ratio based on current-layer / total-layers
   * @param magnify magnification ratio
   */
  _getNoiseDistance( noise, noiseIncrement, dist, layerRatio, magnify=3 ) {

    // noise parameters
    let na = layerRatio;
    let nb = 1 - layerRatio;

    // get next noise
    let layerset = noise.simplex2d( (na)+noiseIncrement, (nb)+noiseIncrement );
    return dist * layerset * (0.5 + magnify*layerRatio);

  }

  /**
   * Given an array of latest values, get the average value and update the array with fresh values
   * @param bufferList an array to hold the latest values
   * @param curr current value to add to array
   * @param max maxmium number of items in the array
   * @returns average number
   * @private
   */
  _smooth( bufferList, curr, max ) {
    bufferList.push( curr );
    if (bufferList.length > max) bufferList.shift();
    let avg = bufferList.reduce( (a,b) => a+b, 0);
    return avg/bufferList.length;
  }


  /**
   * Draw dotted lines
   * @param pts points list
   * @param subdivision how many extra dots per line segments
   * @param largeSize size of vertex
   * @param smallSize size of interpolated points
   */
  dottedLine( pts, subdivision=5, largeSize=2, smallSize=0.5 ) {
    this.points( pts, largeSize, true );

    var last = pts[0];
    for (var i=0; i<pts.length; i++) {
      let ln = new Line( pts[i] ).to( last );
      let lps = ln.subpoints(subdivision);
      this.points( lps, smallSize );
      last = new Vector(ln);
    }
  }

  /**
   * Draw polygons based on "speed
   * @param pts points list
   * @param distRatio distance ratio (0.5)
   */
  speedLine( pts, distRatio=0.5, maxDist=0 ) {

    var last = null;

    for (var i=0; i<pts.length; i++) {
      let vec = new Vector( pts[i] );

      // smooth distance
      let dist = this._getSegmentDistance( last, vec, i ) * distRatio;
      if (maxDist>0) dist = Math.min(dist, maxDist);
      let normal = this._getSegmentNormal( last, vec, dist );
      last = vec.clone();

      // draw normal lines
      this.line( new Line(normal.p1).to(normal.p2));
    }
  }


  zigZagLine( pts, distRatio=0.5, maxDist=0 ) {

    var last = null;
    var zz = [];

    for (var i=0; i<pts.length; i++) {
      let vec = new Vector( pts[i] );

      // smooth distance
      let dist = this._getSegmentDistance( last, vec, i ) * distRatio;
      if (maxDist>0) dist = Math.min(dist, maxDist);

      if (!last) last = vec.clone();
      let ln = new Line(last).to(vec);
      zz.push( ln.getPerpendicular( 0, dist, i%2===0 ).p1 );

      last = vec.clone();
    }

    this.polygon( new Curve().to(zz).catmullRom(5), false, false );
  }


  innerLine( pts, nums = 5, distRatio=0.5, smoothSteps=3, maxDist=0 ) {


    var last = null;
    var normals = [];
    var distSteps = [];

    // init normal arrays
    for (var n=0; n<nums; n++) { normals[n] = []; }

    for (var i=0; i<pts.length; i++) {
      let vec = new Vector( pts[i] );

      // smooth distance
      let dist = this._getSegmentDistance( last, vec, i ) * distRatio;
      if (maxDist>0) dist = Math.min(dist, maxDist);
      dist = this._smooth(distSteps, dist, smoothSteps);

      let normal = this._getSegmentNormal( last, vec, dist );
      last = vec.clone();

      let subs = new Line(normal.p1).to(normal.p2).subpoints(nums);
      for (n=0; n<nums; n++) { normals[n].push( subs[n] ); }

    }

    for (n=0; n<nums; n++) { this.polygon( normals[n], false, false ); }

  }


  innerWiggleLine( pts, nums=5, thickness=100, wiggle={angle: 0, step: 0.01}, distRatio=0.5, smoothSteps=3, maxDist=0 ) {

    var last = null;
    var normals = [];
    var distSteps = [];

    // init normal arrays
    for (var n=0; n<nums; n++) { normals[n] = []; }

    for (var i=0; i<pts.length; i++) {
      let vec = new Vector( pts[i] );

      // smooth distance
      let dist = this._getSegmentDistance( last, vec, i ) * distRatio;
      if (maxDist>0) dist = Math.min(dist, maxDist);
      dist = thickness - Math.max(10, Math.min(thickness, dist) );
      dist = this._smooth(distSteps, dist, smoothSteps);

      let w = (Math.sin( wiggle.angle + wiggle.step*i ) + 1) / 2;

      let normal = this._getSegmentNormal( last, vec, dist, 0.5, w );
      last = vec.clone();

      let subs = new Line(normal.p1).to(normal.p2).subpoints(nums);
      for (n=0; n<nums; n++) { normals[n].push( subs[n] ); }

    }

    for (n=0; n<nums; n++) { this.polygon( normals[n], false, false ); }

  }

  /**
   * Draw polygons based on "speed
   * @param pts points list
   * @param flipSpeed flip thickness (0 or a value such as 10)
   * @param distRatio distance ratio (0.5)
   * @param smoothSteps number of steps per average
   */
  speedPolygon( pts, flipSpeed=0, distRatio=0.5, smoothSteps=1, maxDist=0 ) {

    var last = null;
    var lastNormal = {p1: false, p2: false};
    var distSteps = [];

    // go through each points
    for (var i=0; i<pts.length; i++) {
      let vec = new Vector( pts[i] );

      // smooth distance
      let dist = this._getSegmentDistance( last, vec, i ) * distRatio;
      if (maxDist>0) dist = Math.min(dist, maxDist);
      dist = (flipSpeed > 0) ? flipSpeed - Math.min(flipSpeed, dist) : dist;
      dist = this._smooth(distSteps, dist, smoothSteps);

      let normal = this._getSegmentNormal( last, vec, dist );
      last = vec.clone();

      // draw polygon (quad)
      this.polygon( [lastNormal.p1, lastNormal.p2, normal.p2, normal.p1] );
      lastNormal = normal;
    }
  }


  /**
   * Draw noise polygons
   * @param pts points list
   * @param noise noise instance (seeded)
   * @param nf noise factors { a: current noise value, b: noise scale for layer index, c: noise scale for point index }
   * @param flipSpeed flip thickness (0 or a value such as 10)
   * @param distRatio distance ratio (0.5)
   * @param smoothSteps number of steps per average
   * @param layers number of layers
   * @param magnify magnification ratio
   * @param curveSegments number of segments for curve, or 0 for no curve
   */
  noisePolygon( pts, noise, nf={a:0, b:0.005, c:0.005}, flipSpeed=0, distRatio=0.5, smoothSteps=1, maxDist=0, layers=15,  magnify=3, curveSegments=0 ) {

    var last = null;
    var distSteps = [];

    // segment list keeps track of the points (a simplified convex hull)
    var segs = new SegmentList(layers);

    // go through each points
    for (let i=0; i<pts.length; i++) {
      let vec = new Vector( pts[i] );

      // smooth distance
      let dist = this._getSegmentDistance( last, vec, i ) * distRatio;
      if (maxDist>0) dist = Math.min(dist, maxDist);
      dist = (flipSpeed > 0) ? flipSpeed - Math.min(flipSpeed, dist) : dist;
      dist = this._smooth(distSteps, dist, smoothSteps);

      // noise segments for each layer
      for (let n=1; n<layers; n++) {
        let nfactors =  nf.a + n*nf.b + i*nf.c;
        let ndist = this._getNoiseDistance( noise, nfactors, dist, n/layers, magnify);
        let normal = this._getSegmentNormal( last, vec, ndist );
        segs.add( n, normal.p1, normal.p2 );
      }

      last = vec.clone();
    }

    // draw layered polygons from segment list
    for (let n=1; n<layers; n++) {
      let s = segs.join(n);
      let curve = new Curve().to(s);
      this.polygon(  (curveSegments > 0) ? curve.catmullRom( curveSegments ) : curve.points );
    }

  }

}