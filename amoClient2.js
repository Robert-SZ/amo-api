var assert = require('assert');
var ApiClient = require('apiapi');
var request = require('axios');

var REQUEST_DELAY =1100;

function delayedRequest() {
    var args = arguments;
    return new Promise(function (resolve, reject) {
        setTimeout(function callRequest() {
            return request.apply(request, args)
                .then(resolve)
                .catch(reject);
        }, REQUEST_DELAY);
    });
}

module.exports = function buildClient(baseUrl) {

    let client = new ApiClient({
        baseUrl: baseUrl,
        methods: {
            auth: 'post /private/api/auth.php?type=json',

            getContactsList: 'get /api/v2/contacts/',
            createContact: 'post /api/v2/contacts',
            updateContact: 'post /api/v2/contacts',

            createLead: 'post /api/v2/leads'

        },

        transformRequest: {
            createContact: prepareCreateContact,
            updateContact: prepareUpdateContact,
            createLead: prepareCreateLead
        },
        transformResponse: {
            auth: storeAuth,
            createLead: parseCreateLead,
            createContact: parseCreateContact,
            getContactsList: parseGetContactsList
        }

    });

    function storeAuth(res) {
        let cookies = res.headers['set-cookie'];

        if (!cookies) {
            throw new Error('AmoCRM auth failed');
        }
        this.headers.Cookie = cookies.map(parseCookie).join('; ');
        return res.data;

        function parseCookie(cookieHeader) {
            return cookieHeader.split(';')[0];
        }
    }

    client.request = delayedRequest;
    return client;
};

function prepareCreateContact(params, requestBody, opts) {

    requestBody = {add: [params]};
    return [params, requestBody, opts];
}

function prepareUpdateContact(params, requestBody, opts) {
    requestBody = {update: [params]};
    return [params, requestBody, opts];
}

function prepareCreateLead(params, requestBody, opts) {
    requestBody = {add: [params]};
    return [params, requestBody, opts];
}

function parseCreateLead(res) {
    assert(res.data._embedded.items.length && res.status === 200, 'Lead is not added due to some error');
    return res.data._embedded.items[0];
}

function parseCreateContact(res) {
    assert(res.data._embedded.items.length && res.status === 200, 'Lead is not added due to some error');
    return res.data._embedded.items[0];
}


function parseGetContactsList(res) {
    return res.data._embedded && res.data._embedded.items;
}