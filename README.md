# github_oauth

Node.js based client provididing a github.com OAuth web flow.  Traditionalaly, most applications direct the user directly to github.com to login, then afterwards github.com redirecs the user back to the originating site.  If you are like me, you would prefer to keep the user on your site and provde a better experience.  This client strictly follows the GitHub documented [flow](https://developer.github.com/v3/oauth/#web-application-flow).

## Flow Structure

![alt text](https://raw.githubusercontent.com/ccyphers/github_oauth/master/github_oauth_flow.png "")

## Usage

	var GitHubOAuth = require("github_oauth");

	var github = new GitHubOAuth();

	github.login('github_username', 'github_password')
    	.then(function(res) {
        	console.log(res); // --> {acess_token: 123, token_type: 'bearer'}
	    })
    	.catch(function(err) {
	        console.log(err);
    	})
