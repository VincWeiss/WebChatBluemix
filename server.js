
  var express = require('express');
//  var tls = require('tls');
//  var fs = require('fs');
  var https = require('https');
  var app = express();
  var server = require('http').createServer(app);
  var io = require('socket.io').listen(server);
  var port = process.env.PORT || 80;
  var users = [];
  var usernames = {};  
  var numUsers = 0;
  var userlist = '';
  var cfenv = require('cfenv');	
  var appEnv = cfenv.getAppEnv();
  var dbCreds =  appEnv.getServiceCreds('ChilloutsData');  
  var nano;
  var prints;
  var cloudant = {
		  url : "https://cd01382f-fb5a-4ba8-91eb-90711c0bf890-bluemix:e458604d6682e3144429086aed374ded2ae1944e91dfa08218a6a27155affab7@cd01382f-fb5a-4ba8-91eb-90711c0bf890-bluemix.cloudant.com"          	
  }; 
  var nano = require("nano")(cloudant.url);
  
//  var options = {
//		   key  : fs.readFileSync('server.key'),
//		   cert : fs.readFileSync('server.crt')
//		};
//  https.createServer(options, app).listen(3000, function () {
//	   console.log('Started!');
//	});
  var db = nano.db.use("usercredentials");
	if (dbCreds) {
		console.log('URL is ' + dbCreds.url); 	
		nano = require('nano')(dbCreds.url); 	
		prints = nano.use('prints'); 
	} else {  
		console.log('NO DB!'); 
	}
	
  server.listen(port, function () {
    console.log('Updated : Server listening at port %d', port);
  });
  app.configure(function(){
	  app.use(express.static(__dirname + '/public'));
  });
  
//  var fs = require('fs');
//
//  function setup (ssl) {
//     if (ssl && ssl.active) {
//        return {
//           key  : fs.readFileSync(ssl.key),
//           cert : fs.readFileSync(ssl.certificate)
//        };
//     }
//  }

  function start (app, options) {
     if (options) {
        return require('https').createServer(options, app);
     }
     return require('http').createServer(app);
  }

  module.exports = {
     create: function (settings, app, cb) {
        var options = setup(settings.ssl);
        return start(app, options).listen(settings.port, cb);
     }
  };
  
  app.get('*', function (req, res){
	  res.sendfile(__dirname + '/public/index.html');
  });
  // Routing
  //app.use('/js',  express.static(__dirname + '/public/js'));
  //app.use('/css', express.static(__dirname + '/public/css'));
  
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
        	for ( counter ; counter < users.length; counter++) {
                if(counter === 0){ 
                	msg += users[counter]; 
                } else { 
                	msg += ', ' + users[counter];
                }
            }
        	console.log(msg);
        	 socket.emit('list', msg);

    	}else if(data.indexOf('@') === 0){
    		console.log('found /@');
    		var messageArray = data.split(' ');
    	    var user = messageArray[0];
    	    var privateMessage = messageArray.splice(1).join(' ');
    	    var name;
    	    if (user.charAt(0) === '@') {
    	    	name = user.slice(1);
    	    }
    	    //changed
    		if (name in users){
    			privateMessage = 'private: ' + privateMessage;
    			//changed
    			socket.broadcast.to(users[name].id).emit(
       					'new message',{
    				username: socket.nickname,
					message: privateMessage,
    		        timestamp: Date.now(),
    					}
    			);
    		}
    	}else if(data.includes('/note') || data.includes('/Note')){
    		var noteArray = data.split(' ');
    	    var note = noteArray.splice(1).join(' ');
        	 socket.emit('announce', note);    
        	 } else{        		 
      // Tell the client to execute 'new message'
      socket.broadcast.emit('new message', {
        username: socket.nickname,
        message: data,
        timestamp: Date.now()
      });}
      console.log('I sent it');
    	
    });
    /*
    // when the client emits 'add user', this listens and executes
    socket.on('add user', function (data) {
      // store the username in the socket session for this client
      // add the client's username to the global list
      socket.nickname=data.name;
      users[socket.nickname]=socket;
      ++numUsers;
      addedUser = true;
      db.insert({ _id:data.name, password:data.pw}, function(err, body) {
    	  console.log('Shoulda worked');
    	  if (!err){
    		  console.log('Error');
    		  console.log(body);
    	  } 				
      });
      socket.emit('login', {
        numUsers: numUsers
      });
      // echo globally (all clients) that a person has connected
      socket.broadcast.emit('user joined', {
        username: socket.nickname,
        numUsers: numUsers
      });
    });
  */
    
    
    
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
			      users[socket.nickname]=socket;
			      ++numUsers;
			      addedUser = true;
			      db.insert({ _id:usern, password:pass}, function(err, body) {
			    	  console.log('User isnt registered yet');
			    	  console.log('Inserted in DB is: ' + usern + " PW: " + pass);
			    	  if (!err){
			    		  console.log('User is now registered');
			    		  console.log(body);
			    	  } 
			    	  socket.emit('login', {
					        numUsers: numUsers
					      });
			    	  loginStatus = 1;
			    	  callback(loginStatus);
				      socket.broadcast.emit('user joined', {
				    	  username: socket.nickname,
				    	  numUsers: numUsers
				      });

			      });
			      /*
			      socket.emit('login', {
			        numUsers: numUsers
			      });*/
			     /* // echo globally (all clients) that a person has connected
			      socket.broadcast.emit('user joined', {
			        username: socket.nickname,
			        numUsers: numUsers
			      });
			} else if(data.name in users){
				console.log('USER ALREADY SIGNED IN');
				loginStatus = 2;
				callback(loginStatus);*/
			} else if( data.pw === dataGet.password){
				socket.nickname=data.name;
			      users[socket.nickname]=socket;
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
			/*		
					db.insert({ _id: data.name, password: data.password  }, function(err, body) {
					  if (!err){
						  console.log(body);
					  }
					});
					socket.nickname=data.name;
				    //changed
				      users[socket.nickname]=socket;
				      //users.push(socket.nickname);
				      ++numUsers;
				      socket.emit('login', {
				          numUsers: numUsers
				        });
					socket.broadcast.emit('user joined', {
				        username: socket.nickname,
				        numUsers: numUsers
				      });
				}
		});
    });
    */
    
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
        --numUsers;
  
        // echo globally that this client has left
        socket.broadcast.emit('user left', {
          username: socket.nickname,
          numUsers: numUsers
        });
      }
    });
  });
  
  