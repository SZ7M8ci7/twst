const fs=require('node:fs'),assert=require('node:assert/strict');
function check(report,fixtures){
 let count=0;
 for(const fixture of fixtures){
  const rows=report[fixture.file];assert.ok(rows,fixture.file+' processed');
  assert.equal(rows.length,fixture.expected.length,fixture.file+' complete frames');
  rows.forEach((row,i)=>{
   count++;
   for(const [actual,expected] of [['selected','expected'],['level','levels'],['maxLevel','maxLevels'],['totsu','uncaps']]){
    if(fixture[expected])assert.equal(row[actual]??null,fixture[expected][i],`${fixture.file} #${i+1} ${actual}`);
   }
  });
 }
 return count;
}
if(require.main===module){
 const grid=JSON.parse(fs.readFileSync('artifacts/recognition-collection-grid/final.json'));
 console.log('Collection grid cards/current/max/uncaps:',check(grid,require('./collection-grid-fixture.json').images));
 const posts=JSON.parse(fs.readFileSync('artifacts/recognition-real-posts/final.json'));
 console.log('Original post identities:',check(posts,Object.entries(require('./post-identities.json').images).map(([file,expected])=>({file,expected}))));
}
module.exports={check};
