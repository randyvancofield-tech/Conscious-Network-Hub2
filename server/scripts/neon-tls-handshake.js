const net = require('net');
const tls = require('tls');

const host = process.argv[2] || 'ep-fancy-pond-a4hkk0ow.us-east-1.aws.neon.tech';
const port = Number(process.argv[3] || 5432);

const socket = net.createConnection({ host, port, timeout: 30000 });

socket.once('connect', () => {
  const sslRequest = Buffer.alloc(8);
  sslRequest.writeInt32BE(8, 0);
  sslRequest.writeInt32BE(80877103, 4);
  socket.write(sslRequest);
});

socket.once('data', (chunk) => {
  const response = chunk.toString('utf8', 0, 1);
  console.log('POSTGRES_SSL_RESPONSE', response);
  if (response !== 'S') {
    socket.destroy();
    process.exitCode = 1;
    return;
  }

  const secure = tls.connect({
    socket,
    servername: host,
    rejectUnauthorized: false,
  });

  secure.once('secureConnect', () => {
    const cert = secure.getPeerCertificate();
    console.log(
      'TLS_CONNECTED',
      JSON.stringify({
        authorized: secure.authorized,
        authorizationError: secure.authorizationError || null,
        subject: cert.subject || null,
        issuer: cert.issuer || null,
        valid_to: cert.valid_to || null,
      })
    );
    secure.end();
  });

  secure.once('error', (error) => {
    console.error('TLS_ERROR', error);
    process.exitCode = 1;
  });
});

socket.once('timeout', () => {
  console.error('TCP_TIMEOUT');
  socket.destroy();
  process.exitCode = 1;
});

socket.once('error', (error) => {
  console.error('TCP_ERROR', error);
  process.exitCode = 1;
});
