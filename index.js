const normals = require('angle-normals')
const mat4 = require('gl-mat4')

function drawMesh (regl, mesh) {
  return regl({
    vert: `
      precision mediump float;
      uniform mat4 projection, view;
      attribute vec3 position, normal;
      varying vec3 vNormal;
      void main () {
        vNormal = normal;
        gl_Position = projection * view * vec4(position, 1.0);
      }`,

    frag: `
      precision mediump float;
      varying vec3 vNormal;
      void main () {
        gl_FragColor = vec4(vNormal, 1.0);
      }`,

    // this converts the vertices of the mesh into the position attribute
    attributes: {
      position: mesh.positions,
      normal: mesh.normals
    },

    // and this converts the faces fo the mesh into elements
    elements: mesh.triangles,

    uniforms: {
      model: mat4.identity([]),
      view: ({tick}) => {
        const t = 0.01 * tick
        return mat4.lookAt([],
          [30 * Math.cos(t), 2.5, 30 * Math.sin(t)],
          [0, 2.5, 0],
          [0, 1, 0])
      },
      projection: ({viewportWidth, viewportHeight}) =>
        mat4.perspective([],
          Math.PI / 4,
          viewportWidth / viewportHeight,
          0.01,
          1000)
    }
  })
}

/**
 * convert color from rgba object to the array of bytes
 * @param   {object} color `{r: r, g: g, b: b, a: a}`
 * @returns {Array}  `[r, g, b, a]`
 */
function colorBytes (colorRGBA) {
  var result = [colorRGBA.r, colorRGBA.g, colorRGBA.b]
  if (colorRGBA.a !== undefined) result.push(colorRGBA.a)
  return result
}

function csgToMeshes (csg, options) {
  const defaults = {
    smoothLighting: false, // set to true if we want to use interpolated vertex normals this creates nice round spheres but does not represent the shape of the actual model
    faceColor: '#FF000'// default color
  }
  const {smoothLighting, faceColor} = Object.assign({}, defaults, options)
  const polygons = csg.canonicalized().toPolygons()

  let meshes = []
  let mesh = {}
  let vertexTag2Index = {}

  let positions = []
  let colors = []
  let triangles = []

  /* let positions = new Float32Array(faces * 3 * 3)
  let normals = new Float32Array(faces * 3 * 3) */

  const numpolygons = polygons.length
  for (var j = 0; j < numpolygons; j++) {
    var polygon = polygons[j]
    let color = colorBytes(faceColor)

    if (polygon.shared && polygon.shared.color) {
      color = polygon.shared.color
    } else if (polygon.color) {
      color = polygon.color
    }
    if (color.length < 4) {
      color.push(1.0)
    } // opaque

    const indices = polygon.vertices.map(function (vertex) {
      var vertextag = vertex.getTag()
      var vertexindex = vertexTag2Index[vertextag]
      var prevcolor = colors[vertexindex]
      if (smoothLighting && (vertextag in vertexTag2Index) &&
          (prevcolor[0] === color[0]) &&
          (prevcolor[1] === color[1]) &&
          (prevcolor[2] === color[2])
         ) {
        vertexindex = vertexTag2Index[vertextag]
      } else {
        vertexindex = positions.length
        vertexTag2Index[vertextag] = vertexindex
        positions.push([vertex.pos.x, vertex.pos.y, vertex.pos.z])
        colors.push(color)
      }
      return vertexindex
    })
    for (var i = 2; i < indices.length; i++) {
      triangles.push([indices[0], indices[i - 1], indices[i]])
    }
     // if too many vertices, start a new mesh
    if (positions.length > 65000) {
       // finalize the old mesh
      mesh.triangles = triangles
      mesh.positions = positions
      mesh.colors = colors
      mesh.normals = normals(triangles, positions)

      if (mesh.positions.length) {
        meshes.push(mesh)
      }

      // start a new mesh
      triangles = []
      colors = []
      positions = []
    }
  }
   // finalize last mesh
  mesh.triangles = triangles
  mesh.positions = positions
  mesh.colors = colors
  mesh.normals = normals(triangles, positions)

  if (mesh.positions.length) {
    meshes.push(mesh)
  }
  return mesh
}

module.exports = {
  drawMesh,
  csgToMeshes
}
