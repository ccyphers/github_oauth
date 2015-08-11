// need to instanticate a new instance for each login request so that cookies are not re-used

function GitHubOAuth() {

    var request = require('request')
        , cheerio = require('cheerio')
        , uuid = require('node-uuid')
        , Promise = require('bluebird');


    request = request.defaults({jar: request.jar(), followRedirect: false});
    request = Promise.promisify(request);
    Promise.promisifyAll(request);

    var state = uuid.v4();

    var client_id = process.env.GIT_APP_CLIENT_ID
        , client_secret = process.env.GIT_APP_CLIENT_SECRET;

    function parse_verification_code(str) {
        $body = cheerio.load(str)
        return $body('div.container >div > p > a')[0].attribs.href.split(/code=/)[1].split("&")[0];
    }

    function login_wrap(username, password) {
        return request.getAsync('https://github.com/login/oauth/authorize?client_id=' + client_id + '&state=' + state)
            .then(function (res) {
                var $body = cheerio.load(res[1]);

                var url = $body('a')[0].attribs.href;

                return request.getAsync(url)
            })
            .then(function (res) {
                var $body = cheerio.load(res[1]);
                var csrf = $body('#login > form > div:nth-child(1) > input[type="hidden"]:nth-child(2)');
                var return_to = $body('#return_to');
                var post_data = {};

                post_data[csrf[0].attribs.name] = csrf[0].attribs.value;
                post_data[return_to[0].attribs.name] = return_to[0].attribs.value;
                post_data.login = username;
                post_data.password = password;

                return request.postAsync({url: 'https://github.com/session', form: post_data});
            })
            .then(function (res) {
                if (res[1].match(/You are being.*"https:\/\/github/)) {
                    var $body = cheerio.load(res[1]);
                    return request.getAsync($body('a')[0].attribs.href);
                } else {
                    throw new Error("Invalid username or password");
                }
            })
            .then(function (res) {

                if (res[0].headers.status == '404 Not Found') {
                    throw new Error("Either GIT_APP_CLIENT_ID or GIT_APP_CLIENT_SECRET are invalid")
                }

                if (res[1].match(/\?code=/)) {
                    var verification_code = parse_verification_code(res[1])

                    return Promise.resolve({request: res[0], body: res[1], code: true, verification_code: verification_code});
                } else {
                    return Promise.resolve({request: res[0], body: res[1], code: false});
                }

            })

    }

// in the format of:
// 'access_token=7jf9276f97ca40f52aabc6def4&scope=&token_type=bearer'
    function parse_access_information(str) {
        var access_token = str.split(/access_token=(.*)&scope=/)[1];

        return {
            access_token: access_token,
            token_type: 'bearer'
        }
    }

    this.login = function (username, password) {
        if (!client_id || !client_secret) {
            return Promise.reject("Environment variables missing for either GIT_APP_CLIENT_ID or GIT_APP_CLIENT_SECRET")
        }

        return login_wrap(username, password)
            .then(function (res) {
                // application has allready been added to user's account
                // time to get acess_token
                if (res.code) {

                    var post_data = {
                        client_id: client_id,
                        client_secret: client_secret,
                        code: res.verification_code,
                        state: state
                    };

                    return request.postAsync({url: 'https://github.com/login/oauth/access_token', form: post_data});

                } else { // need to add application to user's account then get access token

                    var $body = cheerio.load(res.body)
                        , post_data = {
                            //client_id: $body('#client_id')[0].attribs.value,
                            client_id: client_id,
                            redirect_uri: $body('#redirect_uri')[0].attribs.value,
                            state: $body('#state')[0].attribs.value,
                            authorize: 1
                        }
                        , csrf = $body('#site-container > div > div.setup-main > form > div:nth-child(1) > input[type="hidden"]:nth-child(2)');

                    post_data[csrf[0].attribs.name] = csrf[0].attribs.value;

                    return request.postAsync({url: 'https://github.com/login/oauth/authorize', form: post_data})
                        .then(function (res) {
                            var code = parse_verification_code(res[1]);

                            var post_data = {
                                client_id: client_id,
                                client_secret: client_secret,
                                code: code,
                                state: state
                            };

                            return request.postAsync({
                                url: 'https://github.com/login/oauth/access_token',
                                form: post_data
                            });

                        });

                }
            })
            .then(function (res) {
                return Promise.resolve(parse_access_information(res[1]))
            })
    }
}

module.exports = GitHubOAuth;

