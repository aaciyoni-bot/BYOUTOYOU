/* Projects the US state outlines into the SVG paths the map draws.
 *
 * Output: public/data/us-states.json — { width, height, states: { CA: {name, d, cx, cy} } }
 *
 * geoAlbersUsa insets Alaska and Hawaii and drops the territories, which is
 * why Puerto Rico and the others are listed as chips beside the map instead.
 */
import fs from 'fs';
import path from 'path';
import * as topojson from 'topojson-client';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { geoAlbersUsa, geoPath } from 'd3-geo';

const OUT = process.env.MAP_OUT || path.join(process.cwd(), 'public', 'data', 'us-states.json');
const ATLAS = path.join(process.cwd(), 'node_modules', 'us-atlas', 'states-10m.json');

const FIPS = {
    '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
    '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
    '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
    '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
    '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
    '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
    '54': 'WV', '55': 'WI', '56': 'WY'
};

const WIDTH = 960, HEIGHT = 600;

const raw = JSON.parse(fs.readFileSync(ATLAS, 'utf8'));
/* Simplifying to the 28th percentile keeps every coastline recognisable at
   this size while cutting the file from 165 KB to under 40. */
const simplified = simplify(presimplify(raw), quantile(presimplify(raw), 0.28));

const projection = geoAlbersUsa().fitSize([WIDTH, HEIGHT], topojson.feature(raw, raw.objects.states));
const toPath = geoPath(projection);
const round = d => d.replace(/-?\d+\.\d+/g, m => (+m).toFixed(0));

const out = { width: WIDTH, height: HEIGHT, states: {} };
for (const feature of topojson.feature(simplified, simplified.objects.states).features) {
    const code = FIPS[String(feature.id).padStart(2, '0')];
    if (!code) continue;
    const d = toPath(feature);
    if (!d) continue;
    const [cx, cy] = toPath.centroid(feature);
    out.states[code] = { name: feature.properties.name, d: round(d), cx: +cx.toFixed(0), cy: +cy.toFixed(0) };
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`Projected ${Object.keys(out.states).length} states into ${path.relative(process.cwd(), OUT)}.`);
