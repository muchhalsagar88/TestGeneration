var Queue = function(){

  var queue  = [];
  var offset = 0;

  this.getLength = function(){
    return (queue.length - offset);
  }

  this.isEmpty = function(){
    return (queue.length == 0);
  }

  this.enqueue = function(item){
    queue.push(item);
  }

  this.dequeue = function(){

    // if the queue is empty, return immediately
    if (queue.length == 0) return undefined;

    var item = queue[offset];

    if (++ offset * 2 >= queue.length){
      queue  = queue.slice(offset);
      offset = 0;
    }

    return item;
  }

  this.peek = function(){
    return (queue.length > 0 ? queue[offset] : undefined);
  }

  this.print = function() {
    var str = "";
    for(var i=0; i<queue.length; ++i){
        str = str+ "|"+queue[i];
    }
    return str;
  }

  this.asArray = function() {
    return queue;
  }
}

exports.Queue = Queue;
