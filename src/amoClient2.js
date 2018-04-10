var assert = require('assert');
var ApiClient = require('apiapi');
var request = require('axios');
var fs = require('fs');

var REQUEST_DELAY = 1100;

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

            getCompanyList: 'get /api/v2/companies',
            getContactsList: 'get /api/v2/contacts/',
            createContact: 'post /api/v2/contacts',
            updateContact: 'post /api/v2/contacts',
            updateCompany: 'post /api/v2/companies',
            createCompany: 'post /api/v2/companies',
            createLead: 'post /api/v2/leads'

        },

        transformRequest: {
            createContact: prepareCreateContact,
            createCompany: prepareCreateCompany,
            updateContact: prepareUpdateContact,
            updateCompany: prepareUpdateCompany,
            createLead: prepareCreateLead
        },
        transformResponse: {
            auth: storeAuth,
            createLead: parseCreateLead,
            createContact: parseCreateContact,
            createCompany: parseCreateCompany,
            getContactsList: parseGetContactsList,
            getCompanyList: parseGetCompaniesList
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
function prepareCreateCompany(params, requestBody, opts) {
    requestBody = {add: [params]};
    return [params, requestBody, opts];
}

function prepareUpdateContact(params, requestBody, opts) {
    requestBody = {update: [params]};
    return [params, requestBody, opts];
}

function prepareUpdateCompany(params, requestBody, opts) {
    requestBody = {update: [params]};
    return [params, requestBody, opts];
}

function prepareCreateLead(params, requestBody, opts) {
    requestBody = {add: [params]};
    return [params, requestBody, opts];
}

function parseCreateLead(res) {
    if (res) {
        assert(res.data._embedded.items.length && res.status === 200, 'Lead is not added due to some error');
        return res.data._embedded.items[0];
    }
}

function parseCreateContact(res) {
    //if (res) {
        //assert(res.data._embedded.items.length && res.status === 200, 'Contact is not added due to some error');
        return res.data._embedded.items[0];
    //}
}

function parseCreateCompany(res) {
    //if (res) {
    //assert(res.data._embedded.items.length && res.status === 200, 'Contact is not added due to some error');
    return res.data._embedded.items[0];
    //}
}




function parseGetContactsList(res) {
    return res.data._embedded && res.data._embedded.items;
}

function parseGetCompaniesList(res){
    return res.data._embedded && res.data._embedded.items;
}