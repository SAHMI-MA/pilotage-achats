// Offline regression checks for SQL patterns used by the D1 compatibility layer.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../db/index.ts',import.meta.url),'utf8');
assert.match(source,/ON CONFLICT DO NOTHING/);
assert.match(source,/jsonb_array_elements/);
assert.match(source,/client\.begin/);
assert.match(source,/revision.*integer/);
const query=`INSERT INTO project_imports (id,source_hash,applied_at,summary,backup_payload,snapshot_verified)
 SELECT ?,?,?,?,?, CASE WHEN (SELECT count(*) FROM projects) = (SELECT count(*) FROM json_each(?))
 AND NOT EXISTS (SELECT 1 FROM json_each(?) expected LEFT JOIN projects current
 ON current.id = json_extract(expected.value,'$.id')
 WHERE current.id IS NULL OR current.revision != json_extract(expected.value,'$.revision')
 OR current.payload != json_extract(expected.value,'$.payload')
 OR current.updated_at != json_extract(expected.value,'$.updated_at')) THEN 1 ELSE 0 END`;
let i=0;
const translated=query.replace(/\?/g,()=>`$${++i}`)
 .replace(/json_each\((\$\d+)\)/gi,(_,p)=>`jsonb_array_elements((${p})::jsonb)`)
 .replace(/json_extract\(expected\.value\s*,\s*'\$\.([a-z_]+)'\)/gi,(_,f)=>f==='revision'?`(expected.value->>'revision')::integer`:`(expected.value->>'${f}')`);
assert.equal(i,7);
assert.doesNotMatch(translated,/json_each|json_extract|\?/);
assert.match(translated,/revision'\)::integer/);
console.log('SQL adapter checks: OK (static; no database connection)');
