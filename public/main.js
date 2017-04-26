/** CloudComputing WebChat on IBM Bluemix **/
/** Client Side App **/

$(function() {
	var FADE_TIME = 150; // ms
	var TYPING_TIMER_LENGTH = 400; // ms
	var COLORS = [ //nickname colors
		'#e21400', '#91580f', '#f8a700', '#f78b00',
		'#508900', '#366420', '#0da784', '#4ae8c4',
		'#3b88eb', '#3824aa', '#a700ff', '#d300e7',
		'#ed72e8', '#ed72a4', '#780a36', '#846132', 
		'#5a3121'
		];
	
	// Initialize varibles
	var $window = $(window);
	var $usernameInput = $('.usernameInput'); // Input for username
	var $passwordInput = $('.passwordInput'); // Input for password
	var $messages = $('.messages'); // Messages area
	var $inputMessage = $('.inputMessage'); // Input message input box
	var $loginPage = $('.login.page'); // The login page
	var $chatPage = $('.chat.page'); // The chatroom page
	var $smilie = $(".smilie");
	
	// Prompt for setting a username
	var username;
	var connected = false;
	var typing = false;
	var lastTypingTime;
	
	// This makes the focus on the username field. Without it we cant enter
	// anything. See $window.keydown(function (event) for more info. Line 227
	var $currentInput = $usernameInput.focus();
	
	var socket = io();
	
	var smiliesMap = {
            ":)" : "1",
            ":(" : "2",
            ";)" : "3",
            ":d" : "4",
            ";;)": "5",
            ":/" : "7",
            ":x" : "8",
            ":p" : "10",
            ":*" : "11",
            ":o" : "13",
            ":>" : "15",
            ":s" : "17",
            ":((": "20",
            ":))": "21",
            ":|": "22",
            ":b": "26",
            ":&": "31",
            ":$": "32",
            ":?" : "39",
            "#o": "40",
            ":ss": "42",
            "@)": "43",
            ":w": "45",
            ":c": "101",
            ":h": "103",
            ":t": "104",
            ":q": "112"
        };
    var smileyReg = /[:;#@]{1,2}[\)\/\(\&\$\>\|xXbBcCdDpPoOhHsStTqQwW*?]{1,2}/g;
    
    function renderSmilies() {
        var $smileyGrid = $(".smiley-grid");

        // render smilies if required
        if($smileyGrid.children().length === 0) {
            var smileisPerRow = 6;
            var $smileySet = $();
            var $smileyRow = $();

            for(var i in smiliesMap) {
                var kids = $smileyRow.children().length;
                if(kids%smileisPerRow === 0) {
                    $smileyRow = $("<div>").addClass("row gap-bottom text-center");
                    $smileySet = $smileySet.add($smileyRow);
                }

                var smileyCol = $("<div>").addClass("col-md-2"),
                    smileyImg = $("<img>").attr({
                        "src": "img/"+smiliesMap[i]+".gif",
                        "title": i.toString(),
                        "data-toggle": "tooltip",
                        "data-placement": "top"
                    }).addClass("smiley-hint");
                smileyCol.append(smileyImg);
                $smileyRow.append(smileyCol);
            }

            $smileyGrid.append($smileySet);
            $(".smiley-hint").on("click", function() {
                var inputText = $inputMessage.val();
                $inputMessage.val(inputText.concat($(this).attr('data-original-title')));

            }).tooltip();
        }

        // toggle smiley container hide
        $(".supported-smilies").toggleClass("hide");
    }
    
    if (name) {
        socket.on("message", function(data) {
            if(data.message) {
                var messageSmilies = data.message.match(smileyReg) || [];
                for(var i=0; i<messageSmilies.length; i++) {
                    var messageSmiley = messageSmilies[i],
                        messageSmileyLower = messageSmiley.toLowerCase();
                    if(smiliesMap[messageSmileyLower]) {
                        data.message = data.message.replace(messageSmiley, "<img src='img/"+smiliesMap[messageSmileyLower]+".gif' alt='smiley' />");
                    }
                }

                data.username = data.username || "Server";
                data.time = data.time || moment(new Date()).format('DD MMM YYYY, HH:mm');

                var template = $.tmpl((data.username === name ? templates.own : templates.users), data);
                history.append(template);
                historyScroll.scrollTop(historyScroll[0].scrollHeight);
            } else {
                console.log("There is a problem:", data);
            }
        });
     
        sendButton.on("click", function() {
            var text = messageInput.val();
            socket.emit("send", { message: text, username: name });
            messageInput.val("");

            return false;
        });

        smilie.on("click", function() {
            renderSmilies();
        }).tooltip();
    } else {
        messageInput.attr("disabled", "disabled");
        sendButton.attr("disabled", "disabled");
        smilie.attr("disabled", "disabled");

        alert("You can't chat without a name!");
    }
	}());
	
	//This logs the current number of participants
	function addParticipantsMessage (data) {
		var message = '';
		if (data.numUsers === 1) {
			message += "there's 1 participant";
			} else {
				message += "there're " + data.numUsers + " participants";
				}
		log(message);
	}
	
	function addPrivateMessage (data) {
		log(data.message);
	}
	
	function showUserlist (data) {
		log(data);
	}
	
	function cChange (data) {
		console.log('Client got it');
		log(data);
	}
	
	function checkPwValid(password){
		var valid = false;
		if(password.length < 4){
			valid = false;
		} else if (password === '' || password.trim() === '' || password.trim().length === 0){
			valid = false;
		} else {
			valid = true;
		} return valid;
	}
	
	// Sets the client's username
	function setUsername () {
		var password = $passwordInput.val();
		var pwValid = checkPwValid(password);
		var reWhiteSpace = new RegExp(" ");
		username = cleanInput($usernameInput.val().trim());

	    // Check for white space
	    if (reWhiteSpace.test(username)) {
			if(!alert("Username mustn't contain spaces!")) {
				window.location.reload();
			}
	    }
		if(!(pwValid)){
			if(!alert("Password must at least contain four characters! \n It musn't contain spaces!")) {
				window.location.reload();
			}		
		} else {
			
			console.log('pw' + password);
			socket.emit('register new user', { name:username, pw:password},function(callbackValue) {
				console.log('Callback ' + callbackValue);
				switch(callbackValue){
				case 1:
					$loginPage.fadeOut();
					$chatPage.show();
					$loginPage.off('click');
					$currentInput = $inputMessage.focus();
					log('Welcome ' + username);
					// Tell the server your username
					break;
				case 2:
					$loginPage.fadeOut();
					$chatPage.show();
					$loginPage.off('click');
					$currentInput = $inputMessage.focus();
					log('Welcome back ' + username);
					// User already registered
					break;
				case 3:
					if(!alert('Username already taken! Or Wrong Password!')) {
						window.location.reload();
					}
					break;
				}
			});
		}
	}

	// Sends a chat message
	function sendMessage () {
		var message = $inputMessage.val();
		// Prevent markup from being injected into the message
		message = cleanInput(message);
		// if there is a non-empty message and a socket connection
		if (message && connected) {
			$inputMessage.val('');
			addChatMessage({
				username: username,
				message: message,
				timestamp: Date.now()
			});
			// tell server to execute 'new message' and send along one parameter
			socket.emit('new message', message);
		}
	}
	
	// Log a message
	function log (message, options) {
		var $el = $('<li>').addClass('log').text(message);
		addMessageElement($el, options);
	}

	// Adds the visual chat message to the message list
	function addChatMessage (data, options) {
		// Don't fade the message in if there is an 'X was typing'
		var $typingMessages = getTypingMessages(data);
		options = options || {};
		if ($typingMessages.length !== 0) {
			options.fade = false;
			$typingMessages.remove();
		}
		var $timestampDiv = $('<span class="timestamp" style = "font-size: 60%"/>')
		.text(formatDate(data.timestamp));
		// Change color if requested by server
		if(data.message.includes('/color') || data.message.includes('/Color')){
			var $usernameDiv = $('<span class="username"/>')
			.text(data.username)
			.css('color', '#'+Math.floor(Math.random()*16777215).toString(16));
			} else {
				var $usernameDiv = $('<span class="username"/>')
				.text(data.username + ':')
				.css('color', getUsernameColor(data.username));
			}
		var $messageBodyDiv = $('<span class="messageBody" style = "height: 100%; margin: 0 auto">')
		.text(data.message);
		var typingClass = data.typing ? 'typing' : '';
		var $messageDiv = $('<li class="message"/>')
		.data('username', data.username)
		.addClass(typingClass)
		.append($usernameDiv, $messageBodyDiv)
		.append($timestampDiv, $messageBodyDiv);
		addMessageElement($messageDiv, options);
	}
	
	// Adds the visual chat typing message
	function addChatTyping (data) {
		data.typing = true;
		data.message = 'is typing';
		addChatMessage(data);
	}

	// Removes the visual chat typing message
	function removeChatTyping (data) {
		getTypingMessages(data).fadeOut(function () {
			$(this).remove();
		});
	}

	// Adds a message element to the messages and scrolls to the bottom
	// options.fade - If the element should fade-in (default = true)
	// options.prepend - If the element should prepend
	function addMessageElement (el, options) {
		var $el = $(el);
		// Setup default options
		if (!options) {
			options = {};
		}
		if (typeof options.fade === 'undefined') {
			options.fade = true;
		}
		if (typeof options.prepend === 'undefined') {
			options.prepend = false;
		}
		// Apply options
		if (options.fade) {
			$el.hide().fadeIn(FADE_TIME);
		}
		if (options.prepend) {
			$messages.prepend($el);
		} else {
			$messages.append($el);
		}
		$messages[0].scrollTop = $messages[0].scrollHeight;
	}

	// Prevents input from having injected markup
	function cleanInput (input) {
		return $('<div/>').text(input).text();
	}
  
	// set and format the date
	function formatDate(dateObj) {
		var d = new Date(dateObj);
		var hours = d.getHours();
		var minutes = d.getMinutes().toString();
		return hours + ":" + (minutes.length === 1 ? '0'+minutes : minutes);
	}
	
	// Updates the typing event
	function updateTyping () {
		if (connected) {
			if (!typing) {
				typing = true;
				socket.emit('typing');
			}
			lastTypingTime = (new Date()).getTime();
			setTimeout(function () {
				var typingTimer = (new Date()).getTime();
				var timeDiff = typingTimer - lastTypingTime;
				if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
					socket.emit('stop typing');
					typing = false;
				}}, TYPING_TIMER_LENGTH);
		}
	}
	
	// Gets the 'X is typing' messages of a user
	function getTypingMessages (data) {
		return $('.typing.message').filter(function (i) {
			return $(this).data('username') === data.username;
		});
	}

// Gets the color of a username through our hash function
	function getUsernameColor (username) {
		// Compute hash code
		var hash = 7;
		for (var i = 0; i < username.length; i++) {
			hash = username.charCodeAt(i) + (hash << 5) - hash;
		}
		// Calculate color
		var index = Math.abs(hash % COLORS.length);
		return COLORS[index];
	}
	
	// Keyboard events
	$window.keydown(function (event) {
		// Auto-focus the current input when a key is typed
		if (!(event.ctrlKey || event.metaKey || event.altKey)) {
			// $currentInput.focus();
			}
		// When the client hits ENTER on their keyboard
		if (event.which === 13) {
			if (username) {
				sendMessage();
				socket.emit('stop typing');
				typing = false;
				} else {
					setUsername();
				}
		}
	});
	
	$inputMessage.on('input', function() {
		updateTyping();
	});
	
	// Click events
	
	// Focus input when clicking anywhere on login page
	// $loginPage.click(function () {
	// $currentInput.focus();
	// });

	// Focus input when clicking on the message input's border
	$inputMessage.click(function () {
		$inputMessage.focus();
	});
	
	// Socket events

	// Whenever the server emits 'login', log the login message
	socket.on('login', function (data) {
		connected = true;
		// Display the welcome message
		log('Welcome to Chillouts');
		addParticipantsMessage(data);
	});
	
	// Show a list of all users
	socket.on('list', function (data) {
		var message = data;
		log('Connected Users are:');
		log(message);
	});
	
	// Show the written Note by the user on his Log
	socket.on('announce', function (data) {
		log('Note: ' + data);
	});

	// Whenever the server emits 'new message', update the chat body
	socket.on('new message', function (data) {
		console.log(data.message);
		addChatMessage(data);
	});
	
	socket.on('show users', function (data) {
		showUserlist(data);
	});

	// Whenever the server emits 'user joined', log it in the chat body
	socket.on('user joined', function (data) {
		console.log("socket.on user joined");
		log(data.username + ' joined');
		addParticipantsMessage(data);
	});

	// Whenever the server emits 'user left', log it in the chat body
	socket.on('user left', function (data) {
		log(data.username + ' left');
		addParticipantsMessage(data);
		removeChatTyping(data);
	});

	// Whenever the server emits 'typing', show the typing message
	socket.on('typing', function (data) {
		addChatTyping(data);
	});

	// Whenever the server emits 'stop typing', kill the typing message
	socket.on('stop typing', function (data) {
		removeChatTyping(data);
	});
	
}); 