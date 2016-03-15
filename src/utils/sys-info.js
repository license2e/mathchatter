const os = require('os'),
      exec = require('child_process').execSync,
      env = process.env,
      humanizeDuration = require('humanize-duration');

exports.gen = function () {
  return [{
    name: 'Node.js Version',
    value: process.version.replace('v', '')
  } , {
    name:  'NPM Version',
    value: exec('npm --version').toString().replace(os.EOL, '')
  }, {
    name:  'OS Type',
    value: os.type()
  }, {
    name:  'OS Platform',
    value: os.platform()
  }, {
    name:  'OS Architecture',
    value: os.arch()
  }, {
    name:  'OS Release',
    value: os.release()
  }, {
    name:  'CPU Cores',
    value: os.cpus().length
  }, {
    name:  'Total Memory',
    value: `${Math.round(os.totalmem() / 10737418.24) / 100} GB`
  }, {
    name:  'Gear Memory',
    value: `${env.OPENSHIFT_GEAR_MEMORY_MB || 'N/A'} MB`
  }, {
    name:  'NODE_ENV',
    value: env.NODE_ENV || 'development'
  }];
};

exports.poll = function () {
  return [{
    name: 'Free Memory',
    value: `${Math.round(os.freemem() / 10737418.24) / 100} GB`
  }, {
    name: 'Uptime',
    value: `${humanizeDuration(os.uptime()*1000)}`
  }];
};
