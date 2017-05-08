/** CloudComputing WebChat on IBM Bluemix **/
/** Server Side App **/

  var express = require('express');
  var fs = require('fs');
  var app = express();
  var server = require('http').createServer(app);
  var io = require('socket.io').listen(server);
  var cfenv = require('cfenv');	
  var redis = require('redis');
  var nconf = require('nconf');
  var appEnv = cfenv.getAppEnv();
  var port = process.env.PORT || 80;
  var users = [];
  var usernames = {};  
  var numUsers = 0;
  var userlist = '';
  var dbCreds =  appEnv.getServiceCreds('ChilloutsData');  
  var nano;
  var prints;
  var cloudant = {
		  url : "https://cd01382f-fb5a-4ba8-91eb-90711c0bf890-bluemix:e458604d6682e3144429086aed374ded2ae1944e91dfa08218a6a27155affab7@cd01382f-fb5a-4ba8-91eb-90711c0bf890-bluemix.cloudant.com"          	
  }; 
  var nano = require("nano")(cloudant.url);
  nconf.env();
  var isDocker = nconf.get('DOCKER') === 'true' ? true : false;

var db = nano.db.use("usercredentials");
	if (dbCreds) {
		console.log('URL is ' + dbCreds.url); 	
		nano = require('nano')(dbCreds.url); 
		prints = nano.use('prints'); 
	} else {  
		console.log('NO DB!'); 
	}

//Sets "X-XSS-Protection: 1; mode=block".
var helmet = require('helmet');

//implementation of our redis service
var redisService = appEnv.getService('RedisChilloutsDB');
var credentials;
if(!redisService || redisService === null) {
  if(isDocker) {
    credentials = {"hostname":"redis", "port":port};
  } else {
    credentials = {"hostname":"127.0.0.1", "port":port};
  }
} else {
  if(isDocker) {
    console.log('The app is running in a Docker container on Bluemix.');
  }
  credentials = redisService.credentials;
}

var subscriber = redis.createClient(credentials.port, credentials.hostname);
subscriber.on('error', function(err) {
  if (isDocker && err.message.match('getaddrinfo EAI_AGAIN')) {
    console.log('Waiting for IBM Containers networking to be available...');
    return;
  }
  console.error('There was an error with the subscriber redis client ' + err);
});
subscriber.on('connect', function() {
  console.log('The subscriber redis client has connected!');

  subscriber.on('message', function(channel, msg) {
    if(channel === 'chatter') {
      while(users.length > 0) {
        var client = users.pop();
        client.end(msg);
      }
    }
  });
  subscriber.subscribe('chatter');
});
var publisher = redis.createClient(credentials.port, credentials.hostname);
publisher.on('error', function(err) {
  if (isDocker && err.message.match('getaddrinfo EAI_AGAIN')) {
    console.log('Waiting for IBM Containers networking to be available...');
    return;
  }
  console.error('There was an error with the publisher redis client ' + err);
});
publisher.on('connect', function() {
  console.log('The publisher redis client has connected!');
});

if (credentials.password !== '' && credentials.password !== undefined) {
    subscriber.auth(credentials.password);
    publisher.auth(credentials.password);
  }

app.use(helmet.xssFilter());
app.use(express.json());

app.enable('trust proxy');
app.use(function (req, res, next) { 	
	if (req.secure) {
		next();
	} else {
		res.redirect('https://' + req.headers.host);
	}
});

server.listen(port, function () {
	console.log('Updated : Server listening at port %d', port);
	});

app.configure(function(){
	app.use(express.static(__dirname + '/public'));
	});

app.get('*', function (req, res){
	res.sendfile(__dirname + '/public/index.html');
	});

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

setInterval(function() {
	  while(users.length > 0) {
	    var client = users.pop();
	    client.writeHeader(204);
	    client.end();
	  }
	}, 60000);

io.on('connection', function (socket) {
	var addedUser = false;
	// when the client emits 'new message', this listens and executes
	socket.on('new message', function (data) {
		if(data === ' '){
			// Check for specific commands
		}else if(data === '/color' || data === '/Color'){
			data = 'changed color';
		}else if(data === '/list' || data === '/List'){
			console.log(socket.nickname + ' called list');
			var counter = 0;
			var msg = '';
			console.log('user.length is ' + users.length);
			for ( counter ; counter < users.length; counter++) {
				if(counter === 0){
					msg += users[counter]; 
					console.log('User in List at index:' + counter + ' IS ' + users[counter]);
					} else { 
						msg += ', ' + users[counter];
					}
				}
			console.log(msg);
			socket.emit('list', msg);
			} else if(data.indexOf('@') === 0){
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
				if (name in usernames){
					privateMessage = 'private: ' + privateMessage;
					console.log("user[name].id to broadcast " + usernames[name].id);
					socket.broadcast.to(usernames[name].id).emit(
    					'new message',{
    						username: socket.nickname,
    						message: privateMessage,
    						timestamp: Date.now(),
    					}
    				);
    			}
			} else if(data.includes('/note') || data.includes('/Note')){
				var noteArray = data.split(' ');
				var note = noteArray.splice(1).join(' ');
				socket.emit('announce', note);    
				} else {
					// Tell the client to execute 'new message'
					socket.broadcast.emit('new message', {
						username: socket.nickname,
						message: data,
						timestamp: Date.now()
					});
				}
		console.log('I sent it');
	});
	
    // Register a new User
    socket.on('register new user', function(data, callback){
    	console.log("REGISTER NEW USER CALLED");
		var usern = data.name;
		var pass = data.pw;
		var loginStatus;
		db.get(usern, function(err, dataGet) {
			if (err){
				console.log("User is new");
				  socket.nickname=usern;
			      users.push(socket.nickname);
			      usernames[socket.nickname] = socket;
			      ++numUsers;
			      addedUser = true;
			      db.insert({ _id:usern, password:pass}, function(err, body) {
			    	  console.log('Inserted in DB entry is: ' + usern + " PW: " + pass);
			    	  if (!err){
			    		  console.log('User is now registered');
			    		  console.log(body);
			    	  } 
			    	  socket.emit('login', {
					        numUsers: numUsers
					      });
			    	  loginStatus = 1;
			    	  callback(loginStatus);
			    	  console.log('called callback after registration');
				      socket.broadcast.emit('user joined', {
				    	  username: socket.nickname,
				    	  numUsers: numUsers
				      });
				      console.log('end of if to register the user');

			      });
			} else if( data.pw === dataGet.password){
				socket.nickname=usern;
			      users.push(socket.nickname);
			      usernames[socket.nickname] = socket;
			      ++numUsers;
			      addedUser = true;
			      db.insert({ _id:data.name, password:data.pw}, function(err, body) {
			    	  console.log('User already registered. Password correct.');
			    	  if (!err){
			    		  console.log('Success');
			    		  console.log(body);
			    	  } 				
			      });
			      socket.emit('login', {
			        numUsers: numUsers
			      });
			      // echo globally (all clients) that a person has connected
			      loginStatus = 2;
			      callback(loginStatus);
			      socket.broadcast.emit('user joined', {
			    	  username: socket.nickname,
			    	  numUsers: numUsers
			      });
					//callback(true);
			}else {
				loginStatus = 3;
				callback(loginStatus);
				//callback(false);
			}
			});			
    });	
    
    // when the client emits 'typing', broadcast it to others
    socket.on('typing', function () {
      socket.broadcast.emit('typing', {
        username: socket.nickname
      });
    });
  
    // when the client emits 'stop typing', broadcast it to others
    socket.on('stop typing', function () {
      socket.broadcast.emit('stop typing', {
        username: socket.nickname
      });
    });
  
    // when the user disconnects.. perform this
    socket.on('disconnect', function () {
      // remove the username from global usernames list
      if (addedUser) {
    	users.splice(users.indexOf(socket.nickname),1);
    	//changed
        delete users[socket.nickname];
        delete usernames[socket.nickname];
        --numUsers;
  
        // echo globally that this client has left
        socket.broadcast.emit('user left', {
          username: socket.nickname,
          numUsers: numUsers
        });
      }
      });
});