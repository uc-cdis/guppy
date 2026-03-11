import cluster from 'cluster';
import os from 'os';

const numCPUs = Math.min(os.cpus().length, 4); // cap at 4 workers

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running, forking ${numCPUs} workers...`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
} else {
  // Each worker runs the full Express server
  import('./server.js');
}
