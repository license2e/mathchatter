(function(window,document,$,Handlebars,undefined){

  var ls = window.localStorage,
    storageKey = 'mc-store',
    storageData = JSON.parse(ls.getItem(storageKey) || '{"username":"","room":""}')
    socket = io.connect('/'),
    updatePath = false;

  var $mcMessages = $('#mc-messages'),
    $mcUserList = $('#mc-userlist'),
    $mcChatForm = $('#mc-chatform'),
    $mcChatInput = $('#mc-chatinput'),
    $mcRoomName = $('#mc-roomname'),
    $mcRoomList = $('#mc-roomlist'),
    $mcAddRoom = $('#mc-addroom');

  var templates = {
    'roomList': Handlebars.compile($('#roomlist-template').html()),
    'roomListItem': Handlebars.compile($('#roomlistitem-template').html()),
    'message': Handlebars.compile($('#message-template').html()),
    'user': Handlebars.compile($('#user-template').html()),
  }

  function saveStorageData(storageData) {
    ls.setItem(storageKey, JSON.stringify(storageData));
  }

  function switchUrl(roomKey) {
    var pushUrl = '/' + roomKey;
    if(pushUrl === '/0'){
      pushUrl = '/'
    }
    window.history.pushState({},'',pushUrl);
  }

  function listUser(username) {
    var userId = 'user-'+username;
    var alreadyAdded = $mcUserList.find('#'+userId);
    if(alreadyAdded.length === 0){
      $mcUserList.append(templates.user({
        id: userId,
        username: username,
      }));
    }
  }

  function scrollToTheBottom() {
    $mcMessages.animate({
      scrollTop: $mcMessages.find('.mc-message:last').offset().top
    }, 150);
  }

  function displayMessage(prepend, data) {
    var username = data.username,
      colorCls = 'mdl-color-text--blue-grey-700',
      prependMessage = prepend || false,
      msgType = data.msgType;
    if(data.username === '__mc') {
      username = '❄ Server';
      colorCls = 'mdl-color-text--blue-900';
      msgType = 'server-msg';
    } else if(data.username === '__mcgame') {
      username = 'Ⓜath';
      colorCls = 'mdl-color-text--blue-500';
      msgType = 'server-msg';
    }
    var msgHtml = templates.message({
      colorCls: colorCls,
      username: username,
      msgType: msgType,
      msg: data.msg,
    });

    if(prependMessage === true){
		  $mcMessages.prepend(msgHtml);
    } else {
      $mcMessages.append(msgHtml);
    }
    scrollToTheBottom();
	}

  // on connection to server, ask for user's name with an anonymous callback
	socket.on('connect', function(){
    var room = window.location.pathname.match(/\/(\d+)/);
    var roomKey = parseInt(room === null ? 0 : room[1])
    if(storageData.username){
      socket.emit('joinUser', storageData.username, roomKey);
    } else {
      socket.emit('addUser');
    }
    socket.emit('getMessages');
	});

  socket.on('setUser', function (username, room, roomName) {
    switchUrl(room)
    storageData.username = username;
    storageData.room = room;
    storageData.roomName = roomName;
    $mcRoomName.html(roomName);
    saveStorageData(storageData);
  });

  socket.on('userConnected', listUser.bind(this));

  socket.on('userDisconnected', function(username) {
    $mcUserList.find('#user-'+username).remove();
  }.bind(this));

  socket.on('updateChat', displayMessage.bind(this, false));
  socket.on('serverMessage', displayMessage.bind(this, false));

  socket.on('roomList', function(rooms) {
    $mcRoomList.html(templates.roomList({rooms: rooms}));
    $mcRoomList.find('#mc-addroom').on('click', function(e) {
      e.preventDefault();
      var roomName = prompt('Please enter the name for the room');
      socket.emit('addRoom', JSON.stringify({"name": roomName}));
      $mcMessages.html('');
      $mcUserList.html('');
    });
    $mcRoomList.find('.mc-room a').on('click', function(e) {
      e.preventDefault();
      var $this = $(e.currentTarget);
      var href = $this.attr('href');
      var roomKey = (href === '' || href === '/') ? 0 : parseInt(href.replace('/',''));
      socket.emit('switchRooms', JSON.stringify({roomKey: roomKey}));
      $mcMessages.html('');
      $mcUserList.html('');
      socket.emit('getMessages');
    });
  });
  socket.emit('getRooms');

  socket.on('roomUsers', function(users){
    users.forEach(function(user){
      listUser(user.name);
    }.bind(this));
  })

  socket.on('roomAdded', function(room) {
    $mcRoomList.find('.mc-room:last').after(templates.roomListItem(room));
    updatePath = true;
  });

  socket.on('messageList', function(msgs) {
    // msgs.sort(function(a, b) {
    //   if (a.createdAt < b.createdAt) {
    //     return -1;
    //   }
    //   if (a.createdAt > b.createdAt) {
    //     return 1;
    //   }
    //   return 0;
    // });

    msgs.forEach(function(msg){
      displayMessage(true, msg);
    });
  });

  $mcChatForm.on('submit', function(e) {
    e.preventDefault();
    var chatInputValue = $mcChatInput.val();
    if(chatInputValue) {
      socket.emit('sendMsg', storageData.username, chatInputValue);
      $mcChatInput.val('')
    }
    return false;
  })


})(this,this.document,jQuery,Handlebars);
