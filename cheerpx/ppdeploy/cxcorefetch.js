var realFetch = self.fetch;
self.fetch = function(u)
{
	var ret = realFetch(cxPath+u);
	// Restore fetch
	self.fetch = realFetch;
	return ret;
};
