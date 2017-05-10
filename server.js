/** CloudComputing WebChat on IBM Bluemix **/
/** Server Side App * */
//Selinas version

var express = require('express');
var app = express();
var server = require('http').createServer(app);
// var io = require('socket.io').listen(server);
var io = require('socket.io').listen(server, {
	transports : [ 'websocket' ]
});
var port = process.env.PORT || 80;
var users = [];
var usernames = {};
var numUsers = 0;
var userlist = '';
var cfenv = require('cfenv');
var appEnv = cfenv.getAppEnv();
var dbCreds = appEnv.getServiceCreds('ChilloutsData');
var nano;
var prints;
var cloudant = {
	url : "https://cd01382f-fb5a-4ba8-91eb-90711c0bf890-bluemix:e458604d6682e3144429086aed374ded2ae1944e91dfa08218a6a27155affab7@cd01382f-fb5a-4ba8-91eb-90711c0bf890-bluemix.cloudant.com"
};
var nano = require("nano")(cloudant.url);

var redisdb = require('socket.io-redis');
io.adapter(redisdb({
	host : 'pub-redis-16144.dal-05.1.sl.garantiadata.com',
	port : '16144',
	password : 'sEl6ybtp7S4FqDvW'
}));

var db = nano.db.use("usercredentials");
if (dbCreds) {
	console.log('URL is ' + dbCreds.url);
	nano = require('nano')(dbCreds.url);
	prints = nano.use('prints');
} else {
	console.log('NO DB!');
}

var helmet = require('helmet');
// Sets "X-XSS-Protection: 1; mode=block".
app.use(helmet.xssFilter());
app.use(express.json());

app.enable('trust proxy');
app.use(function(req, res, next) {
	if (req.secure) {
		next();
	} else {
		res.redirect('https://' + req.headers.host);
	}
});

server.listen(port, function() {
	console.log('Updated : Server listening at port %d', port);
});

app.configure(function() {
	app.use(express.static(__dirname + '/public'));
});

app.get('*', function(req, res) {
	res.sendfile(__dirname + '/public/index.html');
});

/*
 var instanceId = !appEnv.isLocal ? appEnv.app.instance_id : undefined;

 console.log("----------------the instance id " + instanceId);
 app.get('/instanceId', function(req, res) {
 console.log("----------------the app .get method " + instanceId);
 if(!instanceId) {
 res.writeHeader(204);
 res.end();
 } else {
 res.end(JSON.stringify({
 id : instanceId
 }));
 }
 });
 */
io.on('connection', function(socket) {
	var addedUser = false;

	//	var redisClient = redis.createClient();
	//	  redisClient.subscribe('message');	

	// when the client emits 'new message', this listens and executes
	socket.on('new message',
			function(data) {
				if (data === ' ') {
					// Check for specific commands
				} else if (data === '/color' || data === '/Color') {
					data = 'changed color';
				} else if (data === '/list' || data === '/List') {
					console.log(socket.nickname + ' called list');
					var counter = 0;
					var msg = '';
					console.log('user.length is ' + users.length);
					for (counter; counter < users.length; counter++) {
						if (counter === 0) {
							msg += users[counter];
							console.log('User in List at index:' + counter
									+ ' IS ' + users[counter]);
						} else {
							msg += ', ' + users[counter];
						}
					}
					console.log(msg);
					socket.emit('list', msg);
				} else if (data.indexOf('@') === 0) {
					console.log('found /@');
					var messageArray = data.split(' ');
					var user = messageArray[0];
					var privateMessage = messageArray.splice(1).join(' ');
					console.log("the private message " + privateMessage);
					var name;
					if (user.charAt(0) === '@') {
						name = user.slice(1);
						console.log("")
					}
					if (name in usernames) {
						privateMessage = 'private: ' + privateMessage;
						console.log("user[name].id to broadcast "
								+ usernames[name].id);
						socket.broadcast.to(usernames[name].id).emit(
								'new message', {
									username : socket.nickname,
									message : privateMessage,
									timestamp : Date.now(),
								});
					}
				} else if (data.includes('/note') || data.includes('/Note')) {
					var noteArray = data.split(' ');
					var note = noteArray.splice(1).join(' ');
					socket.emit('announce', note);
				} else {
					// Tell the client to execute 'new message'
					socket.broadcast.emit('new message', {
						username : socket.nickname,
						message : data,
						timestamp : Date.now()
					});
				}
				console.log('I sent it');
			});

	// Register a new User
	socket.on('register new user', function(data, callback) {
		console.log("REGISTER NEW USER CALLED");
		var usern = data.name;
		var pass = data.pw;
		var loginStatus;
		db.get(usern, function(err, dataGet) {
			if (err) {
				console.log("User is new");
				socket.nickname = usern;
				users.push(socket.nickname);
				console.log('users[data.name] == ' + users[data.name]);
				console.log('socket.nickname ' + socket.nickname);
				usernames[socket.nickname] = socket;
				++numUsers;
				addedUser = true;
				// Store user data in db
				redisdb.hset([ socket.id, 'connectionDate', new Date() ],
						redisdb.print);
				redisdb.hset([ socket.id, 'socketID', socket.id ],
						redisdb.print);
				redisdb.hset([ socket.id, 'username', usern ], redisdb.print);

				//Redis end
				var instanceId = !appEnv.isLocal ? appEnv.app.instance_id
						: undefined;
				db.insert({
					_id : usern,
					password : pass
				},
						function(err, body) {
							console.log('User isnt registered yet');
							console.log('Inserted in DB is: ' + usern + " PW: "
									+ pass);
							if (!err) {
								console.log('User is now registered');
								console.log(body);
							}
							socket.emit('login', {
								numUsers : numUsers
							});
							loginStatus = 1;
							callback(loginStatus);
							socket.broadcast.emit('user joined', {
								username : socket.nickname,
								numUsers : numUsers,
								instanceId : instanceId
							});

						});
			} else if (data.pw === dataGet.password) {
				socket.nickname = usern;
				users.push(socket.nickname);
				usernames[socket.nickname] = socket;
				++numUsers;
				addedUser = true;
				db.insert({
					_id : data.name,
					password : data.pw
				}, function(err, body) {
					console.log('User already registered. Password correct.');
					if (!err) {
						console.log('Success');
						console.log(body);
					}
				});
				socket.emit('login', {
					numUsers : numUsers
				});
				// echo globally (all clients) that a person has connected
				loginStatus = 2;
				callback(loginStatus);
				socket.broadcast.emit('user joined', {
					username : socket.nickname,
					numUsers : numUsers
				});
				// callback(true);
			} else {
				loginStatus = 3;
				callback(loginStatus);
				// callback(false);
			}
		});
	});

	// when the client emits 'typing', broadcast it to others
	socket.on('typing', function() {
		socket.broadcast.emit('typing', {
			username : socket.nickname
		});
	});

	// when the client emits 'stop typing', broadcast it to others
	socket.on('stop typing', function() {
		socket.broadcast.emit('stop typing', {
			username : socket.nickname
		});
	});

	// when the user disconnects.. perform this
	socket.on('disconnect', function() {
		// remove the username from global usernames list
		if (addedUser) {
			users.splice(users.indexOf(socket.nickname), 1);
			// changed
			delete users[socket.nickname];
			delete usernames[socket.nickname];
			--numUsers;

			// echo globally that this client has left
			socket.broadcast.emit('user left', {
				username : socket.nickname,
				numUsers : numUsers
			});
		}
	});
});