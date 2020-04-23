const httpProxy = require('http-proxy');
const http = require('http');
const net = require('net');
const connect = require('connect');
const harmon = require('harmon');

const app = connect();
const proxy = httpProxy.createProxyServer({});

// utility functions for harmon
function appendHtmlNode(node, html) {
    const rs = node.createReadStream();
    const ws = node.createWriteStream({ outer: false });

    // Read the node and put it back into our write stream,
    // but don't end the write stream when the readStream is closed.
    rs.pipe(ws, { end: false });

    // When the read stream has ended, attach string to the end
    rs.on('end', function() {
        ws.end(html);
    });
}

function replaceHtmlNode(node, html) {
    // Create a read/write stream wit the outer option
    // so we get the full tag and we can replace it
    const stm = node.createStream({ 'outer' : true });

    // variable to hold all the info from the data events
    let tag = '';

    // collect all the data in the stream
    stm.on('data', function(data) {
        tag += data;
    });

    // When the read side of the stream has ended..
    stm.on('end', function() {
        let scriptSrc = '';
        if (node.name === 'script') {
            scriptSrc = `<script type="text/javascript">const appSrc="${tag.slice(13, -11)}"</script>`;
        }

        // Now on the write side of the stream write some data using .end()
        // N.B. if end isn't called it will just hang.
        stm.end(scriptSrc + html);

    });
}

// fix login form action that links to rpvoid.com
app.use('/login', harmon([], [{
    query: '.is-form',
    func : (node) => appendHtmlNode(node, '<script type="text/javascript">const f=document.querySelector(".is-form");f.action="/login"</script>'),
}]));

app.use('/game', harmon([], [{
    query: 'script[src^="/js/app.js"]',
    func : (node) => replaceHtmlNode(node, '<script type="text/javascript" src="https://nabbith.github.io/rpvoid-proxy/custom-rpvoid-client.js"></script>'),
}]));

app.use(function(req, res) {
    const target = 'https://rpvoid.com';
    proxy.on('error', (err) => {
        // console.log('proxy error', err);
        res.end();
    });
    // unsafe settings
    /* proxy.on('proxyRes', function(proxyRes, req, res) {
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost');
        res.setHeader('Access-Control-Allow-Methods', '*');
        res.setHeader('Access-Control-Allow-Headers', 'cache-control, upgrade-insecure-requests, *');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Content-Security-Policy', 'frame-ancestors http://localhost');
    }); */
    proxy.web(req, res, {
        changeOrigin: true,
        autoRewrite: true,
        target: target,
    });
});

const proxyPort = process.env.PORT || 80;
const server = http.createServer(app).listen(proxyPort);

const getHostPortFromString = function(hostString, defaultPort) {
    let host = hostString;
    let port = defaultPort;
    const regex_hostport = /^([^:]+)(:([0-9]+))?$/;
    const result = regex_hostport.exec(hostString);
    if (result != null) {
        host = result[1];
        if (result[2] != null) {
            port = result[3];
        }
    }
    return ([host, port]);
};

server.addListener('connect', function(req, socket, bodyhead) {
    const hostPort = getHostPortFromString(req.url, 443);
    const hostDomain = hostPort[0];
    const port = parseInt(hostPort[1]);
    console.log('Proxying HTTPS request for:', hostDomain, port);

    const proxySocket = new net.Socket();

    proxySocket.connect(port, hostDomain, function() {
        proxySocket.write(bodyhead);
        socket.write('HTTP/' + req.httpVersion + ' 200 Connection established\r\n\r\n');
    });

    proxySocket.on('data', function(chunk) {
        socket.write(chunk);
    });

    proxySocket.on('end', function() {
        socket.end();
    });

    proxySocket.on('error', function() {
        socket.write('HTTP/' + req.httpVersion + ' 500 Connection error\r\n\r\n');
        socket.end();
    });

    socket.on('data', function(chunk) {
        proxySocket.write(chunk);
    });

    socket.on('end', function() {
        proxySocket.end();
    });

    socket.on('error', function() {
        proxySocket.end();
    });

});
