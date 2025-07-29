#!/usr/bin/env node

const { exec } = require('child_process');
const net = require('net');

// Configuration
const DEFAULT_PORT = 5000;
const PORT_RANGE = 100;

// Logger
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`),
  warn: (message) => console.warn(`[WARN] ${message}`),
  success: (message) => console.log(`[SUCCESS] ${message}`)
};

// Check if port is available
const checkPortAvailability = (port) => {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });
    
    server.on('error', (err) => {
      resolve(false);
    });
  });
};

// Find process using port
const findProcessOnPort = (port) => {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
      if (error || !stdout) {
        resolve([]);
        return;
      }
      
      const lines = stdout.trim().split('\n');
      const processes = [];
      
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].includes(`:${port}`)) {
          processes.push({
            protocol: parts[0],
            local: parts[1],
            foreign: parts[2],
            state: parts[3],
            pid: parts[4]
          });
        }
      });
      
      resolve(processes);
    });
  });
};

// Kill process by PID
const killProcess = (pid) => {
  return new Promise((resolve) => {
    exec(`taskkill /PID ${pid} /F`, (error) => {
      resolve(!error);
    });
  });
};

// Get process details
const getProcessDetails = (pid) => {
  return new Promise((resolve) => {
    exec(`tasklist /FI "PID eq ${pid}" /FO CSV`, (error, stdout) => {
      if (error || !stdout) {
        resolve(null);
        return;
      }
      
      const lines = stdout.trim().split('\n');
      if (lines.length < 2) {
        resolve(null);
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
      const data = lines[1].split(',').map(d => d.replace(/"/g, ''));
      
      const processInfo = {};
      headers.forEach((header, index) => {
        processInfo[header.toLowerCase()] = data[index];
      });
      
      resolve(processInfo);
    });
  });
};

// Find available port
const findAvailablePort = async (startPort = DEFAULT_PORT) => {
  let port = startPort;
  let isAvailable = false;
  
  while (!isAvailable && port < startPort + PORT_RANGE) {
    isAvailable = await checkPortAvailability(port);
    if (!isAvailable) {
      port++;
    }
  }
  
  return isAvailable ? port : null;
};

// Main commands
const commands = {
  async check(port = DEFAULT_PORT) {
    logger.info(`Checking port ${port}...`);
    
    const isAvailable = await checkPortAvailability(port);
    if (isAvailable) {
      logger.success(`Port ${port} is available`);
      return;
    }
    
    logger.warn(`Port ${port} is in use`);
    const processes = await findProcessOnPort(port);
    
    if (processes.length === 0) {
      logger.warn('No processes found (might be system reserved)');
      return;
    }
    
    logger.info('Processes using this port:');
    for (const proc of processes) {
      const details = await getProcessDetails(proc.pid);
      logger.info(`  PID: ${proc.pid}, State: ${proc.state}, Local: ${proc.local}`);
      if (details) {
        logger.info(`    Process: ${details['image name']}, Memory: ${details['mem usage']}`);
      }
    }
  },
  
  async kill(port = DEFAULT_PORT) {
    logger.info(`Attempting to free port ${port}...`);
    
    const processes = await findProcessOnPort(port);
    if (processes.length === 0) {
      logger.warn(`No processes found using port ${port}`);
      return;
    }
    
    const uniquePids = [...new Set(processes.map(p => p.pid))];
    let killed = 0;
    
    for (const pid of uniquePids) {
      const details = await getProcessDetails(pid);
      const processName = details ? details['image name'] : 'Unknown';
      
      logger.info(`Killing process ${pid} (${processName})...`);
      const success = await killProcess(pid);
      
      if (success) {
        logger.success(`✓ Process ${pid} killed successfully`);
        killed++;
      } else {
        logger.error(`✗ Failed to kill process ${pid}`);
      }
    }
    
    if (killed > 0) {
      // Wait a moment and check if port is now available
      await new Promise(resolve => setTimeout(resolve, 1000));
      const isNowAvailable = await checkPortAvailability(port);
      
      if (isNowAvailable) {
        logger.success(`Port ${port} is now available!`);
      } else {
        logger.warn(`Port ${port} might still be in use`);
      }
    }
  },
  
  async find(startPort = DEFAULT_PORT) {
    logger.info(`Finding available port starting from ${startPort}...`);
    
    const availablePort = await findAvailablePort(startPort);
    if (availablePort) {
      logger.success(`Available port found: ${availablePort}`);
      return availablePort;
    } else {
      logger.error(`No available ports found in range ${startPort}-${startPort + PORT_RANGE - 1}`);
      return null;
    }
  },
  
  async start(port = DEFAULT_PORT) {
    logger.info(`Starting server on port ${port}...`);
    
    const isAvailable = await checkPortAvailability(port);
    if (isAvailable) {
      logger.success(`Port ${port} is available, starting server...`);
      exec('npm start', (error, stdout, stderr) => {
        if (error) {
          logger.error(`Server start error: ${error.message}`);
          return;
        }
        console.log(stdout);
        if (stderr) console.error(stderr);
      });
      return;
    }
    
    logger.warn(`Port ${port} is in use, attempting to free it...`);
    await this.kill(port);
    
    // Try again after killing
    const isNowAvailable = await checkPortAvailability(port);
    if (isNowAvailable) {
      logger.success(`Port ${port} is now available, starting server...`);
      exec('npm start', (error, stdout, stderr) => {
        if (error) {
          logger.error(`Server start error: ${error.message}`);
          return;
        }
        console.log(stdout);
        if (stderr) console.error(stderr);
      });
    } else {
      logger.warn(`Port ${port} still in use, finding alternative...`);
      const altPort = await this.find(port + 1);
      if (altPort) {
        logger.info(`Starting server on alternative port ${altPort}...`);
        exec(`set PORT=${altPort} && npm start`, (error, stdout, stderr) => {
          if (error) {
            logger.error(`Server start error: ${error.message}`);
            return;
          }
          console.log(stdout);
          if (stderr) console.error(stderr);
        });
      }
    }
  },
  
  help() {
    console.log(`
Port Manager Utility

Usage: node port-manager.js <command> [port]

Commands:
  check [port]    - Check if port is available (default: 5000)
  kill [port]     - Kill processes using the port (default: 5000)
  find [port]     - Find next available port (default: 5000)
  start [port]    - Start server, handling port conflicts (default: 5000)
  help            - Show this help message

Examples:
  node port-manager.js check 5000
  node port-manager.js kill 5000
  node port-manager.js find 5000
  node port-manager.js start 5000
`);
  }
};

// CLI Interface
const main = async () => {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const port = args[1] ? parseInt(args[1]) : DEFAULT_PORT;
  
  if (commands[command]) {
    await commands[command](port);
  } else {
    logger.error(`Unknown command: ${command}`);
    commands.help();
  }
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Error:', error.message);
    process.exit(1);
  });
}

module.exports = { commands, checkPortAvailability, findAvailablePort };