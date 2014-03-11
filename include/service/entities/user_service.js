/**
 * UserService - Service for performing user specific operation.  
 *
 * @author Brian Hyder <brian@pencilblue.org>
 * @copyright PencilBlue 2014, All Rights Reserved
 */
function UserService(){}

UserService.prototype.getFullName = function(userId, cb) {
	var self = this;
	var dao  = new pb.DAO();
	dao.loadById(userId, 'user', function(err, author){
		if (util.isError(err)) {
			callback(err, null);
			return;
		}

		cb(null, self.getFormattedName(author));
	});
};

UserService.prototype.getFormattedName = function(user) {
	var name = user.username;
	if (user.first_name) {
		name = user.first_name + ' ' + user.last_name;
	}
	return name;
};

UserService.prototype.getAuthors = function(objArry, cb){
	var self  = this;
	var tasks = pb.utils.getTasks(objArry, function(objArry, index){
    	return function(callback) {
    		self.getFullName(objArry[index].author, function(err, fullName){
    			objArry[index].author_name = fullName;
    			callback(err, objArry[index]);
    		});
    	};
    });
    async.parallelLimit(tasks, 3, cb);
};

UserService.prototype.getAdminOptions = function(session, localizationService) {
	var adminOptions = [
        {name: localizationService.localize([], '^loc_READER^'), value: ACCESS_USER},
        {name: localizationService.localize([], '^loc_WRITER^'), value: ACCESS_WRITER},
        {name: localizationService.localize([], '^loc_EDITOR^'), value: ACCESS_EDITOR}
    ];
    
    if(session.authentication.user.admin >= ACCESS_MANAGING_EDITOR) {
        adminOptions.push({name: localizationService.localize([], '^loc_MANAGING_EDITOR^'), value: ACCESS_MANAGING_EDITOR});
    }
    if(session.authentication.user.admin >= ACCESS_ADMINISTRATOR) {
        adminOptions.push({name: localizationService.localize([], '^loc_ADMINISTRATOR^'), value: ACCESS_ADMINISTRATOR});
    }
    
    return adminOptions;
};

/**
 * 
 * @param currId The ID of the authenticated user triggering this call
 * @param cb
 */
UserService.prototype.getEditorSelectList = function(currId, cb) {
    var dao     = new pb.DAO();
	var editors = [];
	dao.query('user', {admin: {$gt: ACCESS_WRITER}}, {_id: 1, first_name: 1, last_name: 1}).then(function(data){
        
		for(var i = 0; i < data.length; i++) {
            
			var editor = {_id: data[0]._id, name: data[0].first_name + ' ' + data[0].last_name};
            if(currId == data[i]._id.toString()) {
                editor.selected = 'selected';
            }
            editors.push(editor);
        }
        cb(editors);
    });
};

UserService.prototype.sendVerificationEmail = function(user, cb) {
	cb = cb || pb.utils.cb;
	
	var options = {
		to: user.email,
		subject: 'pencilblue Account Confirmation',
		template: 'admin/elements/default_verification_email',
		replacements: {
			'^verification_url^': pb.config.siteRoot + '/actions/user/verify_email?email=' + user.email + '&code=' + user.verification_code,
			'^first_name^': user.first_name,
			'^last_name^': user.last_name
		}
	};
	pb.sendFromTemplate(options, cb);
};

UserService.prototype.isUserNameOrEmailTaken = function(username, email, id, cb) {
	this.getExistingUsernameEmailCounts(username, email, id, function(err, results) {

		var result = results == null;
		if (!result) {
			
			for(var key in results) {
				result |= results[key] > 0;
			}
		}
		cb(err, result);
	});
};

UserService.prototype.getExistingUsernameEmailCounts = function(username, email, id, cb) {
	var getWhere = function(where) {
		if (id) {
			where._id = {$ne: new ObjectID(id)};
		}
		return where;
	};
	var dao   = new pb.DAO();
	var tasks = {
		verified_username: function(callback) {
			dao.count('user', getWhere({username: username}), callback);
		},
		verified_email: function(callback) {
			dao.count('user', getWhere({email: email}), callback);
		},
		unverified_username: function(callback) {
			dao.count('unverified_user', getWhere({username: username}), callback);
		},
		unverified_email: function(callback) {
			dao.count('unverified_user', getWhere({email: email}), callback);
		},
	};
	async.series(tasks, cb);
};

//exports
module.exports.UserService = UserService;