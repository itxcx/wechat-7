var utils = require('../../../../utils/util.js');
var $ = require('../../../..//utils/ajax.js');
var api = require('../../../../config/api.js');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {},
    isVip: false,
    chooseOptions: [
      { time: 12, currentPrice: 178, oldPrice: 198, sale: 20 },
      { time: 3, currentPrice: 45, oldPrice: 58, sale: 13 }, 
      { time: 1, currentPrice: 15, oldPrice: 19.8, sale: 4.8}
    ],
    hasChoosed: 0,
    payOptions: [
      // { avatar: 'https://www.yanda123.com/app/ali.png', text: '支付宝支付' },
      { avatar: 'https://www.yanda123.com/app/wechat.png', text: '微信支付' }
      // { avatar: 'https://www.yanda123.com/app/bankcard.png', text: '银行卡支付' },
    ],
    payWay: 0,
    nonceStr: '',       // 生成的随机字符串
    prepayId: '',       //调用统一下单接口返回的数值，调用支付api时需要传入
    paySign: '',       // 签名，由自己的后台经md5加密生成的签名
    signType: ''       // 签名，调用微信的统一下单接口后返回的签名
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    let userInfo = wx.getStorageSync('userInfo'); 
    console.log(JSON.stringify(userInfo));
    let isVip = utils.isVip(userInfo);
    this.setData({
      userInfo: userInfo || {},
      isVip: isVip
    });
  },

  /**
   *  改变购买会员的选择天数 
   */
  changeChoose(e) {
    let choosed = e.currentTarget.dataset.choosed;
    this.setData({
      hasChoosed: choosed  
    });
  },

  /**
   * 支付方式的更改
   */
  changePayWay(e) {
    let payWay = e.currentTarget.dataset.pay;
    this.setData({
      payWay: payWay
    });
  },

  /**
   * 调用后台的接口对字符串进行md5加密获取签名
   */
  _getPaySign(str) {
    var promise = new Promise((resolve, reject)=> {
      $.post({
        url: api.GetPaySign,
        data: {
          str: str
        }
      }).then((res) => {
        resolve(res);
      }).catch((err) => {
        reject(err);
      });
    });
    return promise;
  },

  /**
   * 提交支付
   */
  paySubmit(e) {
    let openid = wx.getStorageSync('openid');
    let outTradeNo = utils.getRandomStr(18) + utils.getTodayStr();
    let totalFee = this.data.chooseOptions[this.data.hasChoosed].currentPrice * 100;
    let data = {
      appid: 'wx8c025f88b3f63c44',
      mch_id: '1508748871',
      nonce_str: utils.getRandomStr(32),
      body: 'JSAPI',
      out_trade_no: outTradeNo,
      total_fee: totalFee,
      // spbill_create_ip: '123.12.12.123',
      notify_url: 'http://wxpay.wxutil.com/pub_v2/pay/notify.v2.php',
      trade_type: 'JSAPI',
      openid: openid
    };
    let str = utils.getPaySignStr(data);
    // 先对 str 进行 md5 加密生成签名，然后拼接成xml格式的字符串
    this._getPaySign(str).then((res)=> {
      if(res.data.status === 200) {
        let paySign = res.data.data;
        this.setData({
          paySign: paySign,
          nonceStr: data.nonce_str
        });
        let body = `<xml><appid>${data.appid}</appid><mch_id>${data.mch_id}</mch_id><nonce_str>${data.nonce_str}</nonce_str><body>${data.body}</body><out_trade_no>${data.out_trade_no}</out_trade_no><total_fee>${data.total_fee}</total_fee><notify_url>${data.notify_url}</notify_url><trade_type>${data.trade_type}</trade_type><openid>${data.openid}</openid><sign>${paySign}</sign></xml>`;
        this._getOrder(body);
      }
    }).catch((err)=> {
      console.log('err: ' + err);
    })
  },

  /**
   * 调用统一下单接口，获取prepayId 和 签名 signType
   */
  _getOrder(data) {
    $.post({
      url: 'https://api.mch.weixin.qq.com/pay/unifiedorder',
      data: data
    }).then((res) => {
      console.log(JSON.stringify(res));
      if(res.statusCode === 200) {
        let result = res.data;
        let prepayId = '',
            signType = '';
        let prepayNum1 = result.indexOf('<prepay_id>'),
            prepayNum2 = result.indexOf('</prepay_id>'),
            signNum1 = result.indexOf('<sign>'),
            signNum2 = result.indexOf('</sign>');
        if( prepayNum1 !== -1 ) {
          prepayId = result.substring(prepayNum1+20, prepayNum2-3);
        }
        if( signNum1 !== -1) {
          signType = result.substring(signNum1+15, signNum2-3);
        }
        this.setData({
          prepayId: prepayId,
          signType: signType
        });
        if(prepayId && signType) {
          this._goPay();
        }
      }
    }).catch((err) => {
      console.log(JSON.stringify(err));
    })
  },

  _goPay() {
    let timeStamp = String(~~(new Date().getTime() / 1000));
    let data = {
      appId: 'wx8c025f88b3f63c44',
      timeStamp: timeStamp,
      nonceStr: this.data.nonceStr,
      package: `prepay_id=${this.data.prepayId}`,
      signType: 'MD5'
    };
    let str = utils.getPaySignStr(data);
    this._getPaySign(str).then((res)=> {
      let paySign = res.data.data;
      wx.requestPayment(
        {
          'timeStamp': timeStamp,
          'nonceStr': data.nonceStr,
          'package': `prepay_id=${this.data.prepayId}`,
          'signType': 'MD5',
          'paySign': `${paySign}`,
          'success': (res) => {
            console.log('success: ' + JSON.stringify(res));
          },
          'fail': (err) => {
            console.log('fail: ' + JSON.stringify(err))
          },
          'complete': (res) => { }
        });
    }).catch((err)=> {

    });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
  
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
  
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
  
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
  
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
  
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {
  
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
  
  }
})