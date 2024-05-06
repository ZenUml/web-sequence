//Paddle.Setup({ vendor: 39343 }); //eslint-disable-line
Paddle.Environment.set('sandbox');
Paddle.Initialize({
  token: 'test_9821a955def912df28d650eb53c',
  eventCallback: function (data) {
    if (data.name == 'checkout.completed') {
      console.log(data);
      location.reload();
    }
  },
});
