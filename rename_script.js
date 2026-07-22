const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'build') {
        filelist = walkSync(dirFile, filelist);
      }
    } else {
      if (dirFile.match(/\.(js|jsx|ts|tsx|json|html|css|md|env)$/)) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
};

const files = walkSync('C:\\Users\\Abcom\\Desktop\\AppzetoProjects\\food-galaxy');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace THE FOOD GALAXY with THE FOOD GALAXY
  content = content.replace(/THE FOOD GALAXY/g, 'THE FOOD GALAXY');
  
  // Replace The Food Galaxy with The Food Galaxy, except in URLs or package names
  content = content.replace(/(?<![\/\-\w])The Food Galaxy(?![\-\w])/g, 'The Food Galaxy');
  
  // For lowercase the food galaxy, only replace if it looks like standalone text (e.g., 'the food galaxy data')
  // We'll replace it in specific known contexts to be safe, or just standalone with word boundaries
  // But wait, the user asked to change theFoodGalaxy / the food galaxy where needed.
  // Let's replace 'thefoodgalaxy' to 'the food galaxy' if preceded by a space and followed by a space or punctuation, 
  // but exclude URLs (/) and package names (-) and paths (/)
  content = content.replace(/(?<![\/\-\w])thefoodgalaxy(?=[\s\.,!\?])/g, 'the food galaxy');
  
  // Fix specific known cases if they got messed up:
  // (We don't want to break "thefoodgalaxy-backend" or "https://.../TheFoodGalaxy-Brand-Image.png")
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
